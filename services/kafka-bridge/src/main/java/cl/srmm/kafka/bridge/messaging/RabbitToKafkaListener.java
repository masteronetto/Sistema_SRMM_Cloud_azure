package cl.srmm.kafka.bridge.messaging;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.rabbitmq.client.Channel;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
public class RabbitToKafkaListener {

    private static final Logger LOGGER = LoggerFactory.getLogger(RabbitToKafkaListener.class);

    private final RabbitEventMapper eventMapper;
    private final KafkaEventProducer kafkaProducer;
    private final ObjectMapper objectMapper;

    public RabbitToKafkaListener(
            RabbitEventMapper eventMapper,
            KafkaEventProducer kafkaProducer,
            ObjectMapper objectMapper
    ) {
        this.eventMapper = eventMapper;
        this.kafkaProducer = kafkaProducer;
        this.objectMapper = objectMapper;
    }

    @RabbitListener(
            queues = BridgeRabbitTopology.RENTAL_QUEUE,
            containerFactory = "rabbitListenerContainerFactory")
    public void consumeRental(Message message, Channel channel) throws IOException {
        consume(message, channel, BridgeRabbitTopology.RENTAL_QUEUE,
                BridgeRabbitTopology.RENTAL_ROUTING_KEY, "arriendos", "id_contrato");
    }

    @RabbitListener(
            queues = BridgeRabbitTopology.LOGISTICS_QUEUE,
            containerFactory = "rabbitListenerContainerFactory")
    public void consumeLogistics(Message message, Channel channel) throws IOException {
        consume(message, channel, BridgeRabbitTopology.LOGISTICS_QUEUE,
                BridgeRabbitTopology.LOGISTICS_ROUTING_KEY, "logistica", "id_evento");
    }

    @RabbitListener(
            queues = BridgeRabbitTopology.MAINTENANCE_QUEUE,
            containerFactory = "rabbitListenerContainerFactory")
    public void consumeMaintenance(Message message, Channel channel) throws IOException {
        consume(message, channel, BridgeRabbitTopology.MAINTENANCE_QUEUE,
                BridgeRabbitTopology.MAINTENANCE_ROUTING_KEY, "mantenimientos", "id_incidencia");
    }

    private void consume(
            Message message,
            Channel channel,
            String queue,
            String expectedEventType,
            String domain,
            String businessIdField
    ) throws IOException {
        long deliveryTag = message.getMessageProperties().getDeliveryTag();
        MappedRabbitEvent mapped;
        try {
            mapped = eventMapper.map(message.getBody(), expectedEventType, domain, businessIdField);
            kafkaProducer.publish(mapped);
        } catch (InvalidRabbitEventException exception) {
            LOGGER.warn("Rejecting invalid RabbitMQ event to DLQ. eventId={} queue={} reason={}",
                    exception.getEventId(), queue, exception.getMessage());
            channel.basicNack(deliveryTag, false, false);
            return;
        } catch (RuntimeException exception) {
            LOGGER.error("RabbitMQ to Kafka delivery failed; requeueing. eventId={} queue={} reason={}",
                    eventIdFrom(message), queue, exception.getMessage(), exception);
            channel.basicNack(deliveryTag, false, true);
            return;
        }

        channel.basicAck(deliveryTag, false);
        LOGGER.info("RabbitMQ event acknowledged after Kafka publish. eventId={} queue={}",
                mapped.operationalEvent().eventId(), queue);
    }

    private String eventIdFrom(Message message) {
        try {
            JsonNode event = objectMapper.readTree(message.getBody());
            return event.path("eventId").asText("unknown");
        } catch (IOException exception) {
            return "unknown";
        }
    }
}
