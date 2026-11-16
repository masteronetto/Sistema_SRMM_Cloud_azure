package cl.srmm.kafka.bridge.messaging;

import cl.srmm.kafka.bridge.messaging.dto.EstadoMaquinariaDto;
import cl.srmm.kafka.bridge.messaging.dto.EventoOperacionalDto;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.time.Instant;
import java.time.format.DateTimeParseException;

@Component
public class RabbitEventMapper {

    private final ObjectMapper objectMapper;

    public RabbitEventMapper(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public MappedRabbitEvent map(byte[] body, String expectedEventType, String domain, String businessIdField) {
        JsonNode event;
        try {
            event = objectMapper.readTree(body);
        } catch (IOException exception) {
            throw new InvalidRabbitEventException("unknown", "El mensaje no contiene JSON válido.", exception);
        }
        if (event == null || !event.isObject()) {
            throw new InvalidRabbitEventException("unknown", "El mensaje debe contener un objeto JSON.");
        }
        String eventId = text(event, "eventId");
        String eventType = text(event, "eventType");
        if (!expectedEventType.equals(eventType)) {
            throw invalid(eventId, "Tipo de evento inesperado; se esperaba " + expectedEventType + ".");
        }

        JsonNode data = event.path("data");
        if (!data.isObject()) {
            throw invalid(eventId, "El evento no contiene un objeto data.");
        }
        String businessId = text(data, businessIdField, eventId);
        Instant occurredAt = timestamp(event, "occurredAt", eventId);
        EventoOperacionalDto operational = new EventoOperacionalDto(
                eventId, eventType, domain, occurredAt, data);
        EstadoMaquinariaDto machineryState = machineryState(eventType, domain, data, occurredAt, eventId);
        return new MappedRabbitEvent(operational, machineryState, domain + ":" + businessId);
    }

    private EstadoMaquinariaDto machineryState(
            String eventType,
            String domain,
            JsonNode data,
            Instant occurredAt,
            String eventId
    ) {
        if (BridgeRabbitTopology.LOGISTICS_ROUTING_KEY.equals(eventType)) {
            JsonNode machineryId = data.path("maquinaria_id_maquina");
            if (machineryId.isMissingNode() || machineryId.isNull() || machineryId.asText().isBlank()) {
                return null;
            }
            String state = text(data, "estado_evento");
            return new EstadoMaquinariaDto(
                    machineryId(machineryId, eventId), state, domain, occurredAt);
        }
        if (BridgeRabbitTopology.MAINTENANCE_ROUTING_KEY.equals(eventType)) {
            String machineryId = machineryId(data.path("maquinaria_id_maquina"), eventId);
            String state = text(data, "estado");
            return new EstadoMaquinariaDto(machineryId, state, domain, occurredAt);
        }
        return null;
    }

    private String machineryId(JsonNode value, String eventId) {
        if (value.isIntegralNumber() && value.longValue() > 0) {
            return value.asText();
        }
        if (value.isTextual() && value.asText().matches("[1-9][0-9]*")) {
            return value.asText();
        }
        throw invalid(eventId, "maquinaria_id_maquina debe ser un identificador positivo.");
    }

    private Instant timestamp(JsonNode object, String field, String eventId) {
        String value = text(object, field);
        try {
            return Instant.parse(value);
        } catch (DateTimeParseException exception) {
            throw new InvalidRabbitEventException(eventId, field + " debe ser una fecha ISO-8601.", exception);
        }
    }

    private String text(JsonNode object, String field) {
        return text(object, field, "unknown");
    }

    private String text(JsonNode object, String field, String eventId) {
        JsonNode value = object.path(field);
        if (value.isMissingNode() || value.isNull() || value.asText().isBlank()) {
            throw invalid(eventId, "El evento no contiene " + field + ".");
        }
        return value.asText();
    }

    private InvalidRabbitEventException invalid(String eventId, String message) {
        return new InvalidRabbitEventException(eventId, message);
    }
}
