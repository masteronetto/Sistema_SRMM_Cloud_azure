package cl.srmm.notificaciones.dlq;

import cl.srmm.notificaciones.config.RabbitTopology;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageProperties;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

class DeadLetterDescriberTest {

    private final DeadLetterDescriber describer = new DeadLetterDescriber(new ObjectMapper());

    @Test
    void extractsEventIdQueueAndReasonFromXDeath() {
        MessageProperties properties = new MessageProperties();
        properties.setHeader("x-death", List.of(Map.of(
                "queue", RabbitTopology.LOGISTICS_QUEUE, "reason", "rejected", "count", 1L)));
        Message message = new Message("{\"eventId\":\"abc-123\"}".getBytes(StandardCharsets.UTF_8), properties);

        DeadLetterInfo info = describer.describe(message);

        assertEquals("abc-123", info.eventId());
        assertEquals(RabbitTopology.LOGISTICS_QUEUE, info.queue());
        assertEquals("rejected", info.reason());
        assertEquals(1L, info.count());
    }

    @Test
    void prefersFirstDeathHeadersAndMessageId() {
        MessageProperties properties = new MessageProperties();
        properties.setMessageId("msg-77");
        properties.setHeader("x-first-death-queue", RabbitTopology.RENTAL_QUEUE);
        properties.setHeader("x-first-death-reason", "rejected");
        Message message = new Message("{}".getBytes(StandardCharsets.UTF_8), properties);

        DeadLetterInfo info = describer.describe(message);

        assertEquals("msg-77", info.eventId());
        assertEquals(RabbitTopology.RENTAL_QUEUE, info.queue());
        assertEquals("rejected", info.reason());
    }

    @Test
    void usesDefaultsWhenBodyIsMalformedAndHeadersAreMissing() {
        Message message = new Message("{invalid".getBytes(StandardCharsets.UTF_8), new MessageProperties());

        DeadLetterInfo info = describer.describe(message);

        assertEquals("desconocido", info.eventId());
        assertEquals("desconocido", info.queue());
        assertEquals("desconocido", info.reason());
        assertEquals(1L, info.count());
    }
}