package cl.srmm.kafka.bridge.messaging.dto;

import com.fasterxml.jackson.databind.JsonNode;

import java.time.Instant;

public record EventoOperacionalDto(
        String eventId,
        String tipo,
        String dominio,
        Instant occurredAt,
        JsonNode payload
) {
}
