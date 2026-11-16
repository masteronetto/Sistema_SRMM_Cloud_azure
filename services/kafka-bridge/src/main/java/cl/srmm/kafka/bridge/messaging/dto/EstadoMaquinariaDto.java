package cl.srmm.kafka.bridge.messaging.dto;

import java.time.Instant;

public record EstadoMaquinariaDto(
        String idMaquinaria,
        String estado,
        String origen,
        Instant updatedAt
) {
}
