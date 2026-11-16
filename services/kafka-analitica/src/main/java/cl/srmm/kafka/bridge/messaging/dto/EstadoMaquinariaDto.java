package cl.srmm.kafka.bridge.messaging.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;

public record EstadoMaquinariaDto(
        @NotBlank
        String idMaquinaria,
        @NotBlank
        String estado,
        @NotBlank
        String origen,
        @NotNull
        Instant updatedAt
) {
}
