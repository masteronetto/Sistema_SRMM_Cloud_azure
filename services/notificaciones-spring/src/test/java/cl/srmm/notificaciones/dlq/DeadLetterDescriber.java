package cl.srmm.notificaciones.dlq;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.amqp.core.Message;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.List;
import java.util.Map;

@Component
public class DeadLetterDescriber {

    private static final String UNKNOWN = "desconocido";

    private final ObjectMapper objectMapper;

    public DeadLetterDescriber(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public DeadLetterInfo describe(Message message) {
        Map<String, Object> headers = message.getMessageProperties().getHeaders();
        String queue = asString(headers.get("x-first-death-queue"));
        String reason = asString(headers.get("x-first-death-reason"));
        long count = 1;

        Object death = headers.get("x-death");
        if (death instanceof List<?> deaths && !deaths.isEmpty() && deaths.get(0) instanceof Map<?, ?> first) {
            if (queue == null) {
                queue = asString(first.get("queue"));
            }
            if (reason == null) {
                reason = asString(first.get("reason"));
            }
            if (first.get("count") instanceof Number number) {
                count = number.longValue();
            }
        }
        return new DeadLetterInfo(eventId(message), queue != null ? queue : UNKNOWN,
                reason != null ? reason : UNKNOWN, count);
    }

    private String eventId(Message message) {
        String messageId = message.getMessageProperties().getMessageId();
        if (messageId != null && !messageId.isBlank()) {
            return messageId;
        }
        try {
            JsonNode id = objectMapper.readTree(message.getBody()).path("eventId");
            if (id.isTextual() && !id.asText().isBlank()) {
                return id.asText();
            }
        } catch (IOException | RuntimeException ignored) {
            // cuerpo malformado: se registra como desconocido
        }
        return UNKNOWN;
    }

    private static String asString(Object value) {
        return value == null ? null : String.valueOf(value);
    }
}