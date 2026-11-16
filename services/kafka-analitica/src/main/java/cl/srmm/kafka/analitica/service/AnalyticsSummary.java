package cl.srmm.kafka.analitica.service;

import cl.srmm.kafka.bridge.messaging.dto.EstadoMaquinariaDto;

import java.time.Instant;
import java.util.Map;

public record AnalyticsSummary(
        Instant generatedAt,
        Instant windowStart,
        long windowSeconds,
        Map<String, Long> eventCountsByDomain,
        Map<String, EstadoMaquinariaDto> lastStateByMachinery
) {
}
