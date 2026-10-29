package cl.srmm.notificaciones;

import cl.srmm.notificaciones.config.RabbitTopology;
import cl.srmm.notificaciones.service.NotificationEventHandler;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageBuilder;
import org.springframework.amqp.core.MessageDeliveryMode;
import org.springframework.amqp.core.MessageProperties;
import org.springframework.amqp.rabbit.core.RabbitAdmin;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

@SpringBootTest
@ActiveProfiles("test")
class NotificationsIntegrationTest {

    @Autowired
    private RabbitTemplate rabbitTemplate;

    @Autowired
    private RabbitAdmin rabbitAdmin;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoSpyBean
    private NotificationEventHandler eventHandler;

    @BeforeEach
    void clearQueues() {
        purgeQueues(
                RabbitTopology.RENTAL_QUEUE, RabbitTopology.RENTAL_DLQ,
                RabbitTopology.LOGISTICS_QUEUE, RabbitTopology.LOGISTICS_DLQ,
                RabbitTopology.MAINTENANCE_QUEUE, RabbitTopology.MAINTENANCE_DLQ
        );
        reset(eventHandler);
    }

    @Test
    void consumesSuccessfulRentalEvent() throws Exception {
        publish(RabbitTopology.RENTAL_EXCHANGE, RabbitTopology.RENTAL_ROUTING_KEY,
                "arriendo.creado", Map.of("id_contrato", 101));

        verify(eventHandler, timeout(5_000).times(1)).handleRental(any(Message.class));
    }

    @Test
    void routesFailedRentalEventToDeadLetterQueueAfterRetries() throws Exception {
        publish(RabbitTopology.RENTAL_EXCHANGE, RabbitTopology.RENTAL_ROUTING_KEY,
                "arriendo.creado", Map.of("id_invalido", 101));

        assertDeadLetter(RabbitTopology.RENTAL_DLQ);
        verify(eventHandler, times(3)).handleRental(any(Message.class));
    }

    @Test
    void consumesSuccessfulLogisticsEvent() throws Exception {
        publish(RabbitTopology.LOGISTICS_EXCHANGE, RabbitTopology.LOGISTICS_ROUTING_KEY,
                "logistica.estado-cambiado", Map.of("id_evento", 202));

        verify(eventHandler, timeout(5_000).times(1)).handleLogistics(any(Message.class));
    }

    @Test
    void routesFailedLogisticsEventToDeadLetterQueueAfterRetries() throws Exception {
        publish(RabbitTopology.LOGISTICS_EXCHANGE, RabbitTopology.LOGISTICS_ROUTING_KEY,
                "logistica.estado-cambiado", Map.of("id_evento", ""));

        assertDeadLetter(RabbitTopology.LOGISTICS_DLQ);
        verify(eventHandler, times(3)).handleLogistics(any(Message.class));
    }

    @Test
    void consumesSuccessfulCriticalMaintenanceEvent() throws Exception {
        publish(RabbitTopology.MAINTENANCE_EXCHANGE, RabbitTopology.MAINTENANCE_ROUTING_KEY,
                "mantenimiento.incidencia-critica", Map.of("id_incidencia", 303));

        verify(eventHandler, timeout(5_000).times(1)).handleMaintenance(any(Message.class));
    }

    @Test
    void routesFailedMaintenanceEventToDeadLetterQueueAfterRetries() throws Exception {
        publish(RabbitTopology.MAINTENANCE_EXCHANGE, RabbitTopology.MAINTENANCE_ROUTING_KEY,
                "mantenimiento.incidencia-critica", Map.of("criticidad", "Alta"));

        assertDeadLetter(RabbitTopology.MAINTENANCE_DLQ);
        verify(eventHandler, times(3)).handleMaintenance(any(Message.class));
    }

    private void publish(String exchange, String routingKey, String eventType, Map<String, Object> data)
            throws Exception {
        var event = Map.of(
                "eventId", UUID.randomUUID().toString(),
                "eventType", eventType,
                "occurredAt", Instant.now().toString(),
                "data", data
        );
        var properties = new MessageProperties();
        properties.setContentType(MessageProperties.CONTENT_TYPE_JSON);
        properties.setDeliveryMode(MessageDeliveryMode.PERSISTENT);
        rabbitTemplate.send(exchange, routingKey, MessageBuilder
                .withBody(objectMapper.writeValueAsBytes(event))
                .andProperties(properties)
                .build());
    }

    private void assertDeadLetter(String queue) {
        Message deadLetter = rabbitTemplate.receive(queue, 10_000);
        assertNotNull(deadLetter, "El mensaje fallido debe llegar a la DLQ.");
        Object deathHeader = deadLetter.getMessageProperties().getHeaders().get("x-death");
        assertNotNull(deathHeader, "RabbitMQ debe añadir los metadatos x-death.");
        assertEquals("rejected", firstDeathReason(deathHeader));
    }

    private String firstDeathReason(Object deathHeader) {
        var deaths = (List<?>) deathHeader;
        var firstDeath = (Map<?, ?>) deaths.get(0);
        return firstDeath.get("reason").toString();
    }

    private void purgeQueues(String... queues) {
        for (String queue : queues) {
            rabbitAdmin.purgeQueue(queue);
        }
    }
}
