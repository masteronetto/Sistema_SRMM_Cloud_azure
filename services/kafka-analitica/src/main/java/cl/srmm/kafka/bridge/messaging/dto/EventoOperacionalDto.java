package cl.srmm.kafka.bridge.messaging.dto;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;

public record EventoOperacionalDto(
        @NotBlank
        String eventId,
        @NotBlank
        String tipo,
        @NotBlank
        String dominio,
        @NotNull
        Instant occurredAt,
        @NotNull
        JsonNode payload
) {
}
