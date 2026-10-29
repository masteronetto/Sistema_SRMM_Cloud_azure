package cl.srmm.notificaciones.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.amqp.core.Message;
import org.springframework.stereotype.Component;

import java.io.IOException;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Component
public class NotificationEventHandler {

    private static final Logger LOGGER = LoggerFactory.getLogger(NotificationEventHandler.class);

    private final ObjectMapper objectMapper;

    public NotificationEventHandler(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public void handleRental(Message message) {
        handle(message, "arriendo.creado", "id_contrato", "arriendo");
    }

    public void handleLogistics(Message message) {
        handle(message, "logistica.estado-cambiado", "id_evento", "logistica");
    }

    public void handleMaintenance(Message message) {
        handle(message, "mantenimiento.incidencia-critica", "id_incidencia", "mantenimiento");
    }

    private void handle(Message message, String expectedType, String requiredId, String domain) {
        JsonNode event;
        try {
            event = objectMapper.readTree(message.getBody());
        } catch (IOException exception) {
            throw new IllegalArgumentException("El mensaje no contiene un evento JSON válido.", exception);
        }

        String eventType = textValue(event, "eventType");
        if (!expectedType.equals(eventType)) {
            throw new IllegalArgumentException("Tipo de evento inesperado para " + domain + ".");
        }

        JsonNode data = event.path("data");
        JsonNode identifier = data.path(requiredId);
        if (identifier.isMissingNode() || identifier.isNull() || identifier.asText().isBlank()) {
            throw new IllegalArgumentException("El evento de " + domain + " no contiene " + requiredId + ".");
        }

        LOGGER.info("Evento de {} procesado correctamente: eventId={}, {}={}",
                domain, textValue(event, "eventId"), requiredId, identifier.asText());
    }

    private String textValue(JsonNode event, String field) {
        JsonNode value = event.path(field);
        if (value.isMissingNode() || value.isNull() || value.asText().isBlank()) {
            throw new IllegalArgumentException("El evento no contiene " + field + ".");
        }
        return value.asText();
    }
}
