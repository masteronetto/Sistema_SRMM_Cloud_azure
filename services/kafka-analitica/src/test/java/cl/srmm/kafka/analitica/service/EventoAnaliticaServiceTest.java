package cl.srmm.kafka.analitica.service;

import cl.srmm.kafka.bridge.messaging.dto.EstadoMaquinariaDto;
import cl.srmm.kafka.bridge.messaging.dto.EventoOperacionalDto;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

class EventoAnaliticaServiceTest {

    private static final Instant NOW = Instant.parse("2026-11-16T12:00:00Z");

    @Test
    void summarizesOnlyEventsInsideTheConfiguredWindowByDomain() {
        EventoAnaliticaService service = service();
        service.registrarEventoOperacional(event("evt-1", "arriendos", NOW.minusSeconds(30)));
        service.registrarEventoOperacional(event("evt-2", "arriendos", NOW.minusSeconds(60)));
        service.registrarEventoOperacional(event("evt-3", "logistica", NOW.minusSeconds(301)));

        AnalyticsSummary summary = service.resumen();

        assertEquals(300, summary.windowSeconds());
        assertEquals(Map.of("arriendos", 2L, "logistica", 0L), summary.eventCountsByDomain());
        assertEquals(NOW.minusSeconds(300), summary.windowStart());
    }

    @Test
    void retainsTheNewestStatePerMachineAndIgnoresOutOfOrderUpdates() {
        EventoAnaliticaService service = service();
        service.registrarEstadoMaquinaria(state("10", "Disponible", NOW.minusSeconds(60)));
        service.registrarEstadoMaquinaria(state("10", "En Ruta", NOW.minusSeconds(10)));
        service.registrarEstadoMaquinaria(state("10", "Taller", NOW.minusSeconds(30)));
        service.registrarEstadoMaquinaria(state("20", "Disponible", NOW.minusSeconds(15)));

        AnalyticsSummary summary = service.resumen();

        assertEquals("En Ruta", summary.lastStateByMachinery().get("10").estado());
        assertEquals("Disponible", summary.lastStateByMachinery().get("20").estado());
    }

    private EventoAnaliticaService service() {
        return new EventoAnaliticaService(
                Duration.ofMinutes(5),
                Clock.fixed(NOW, ZoneOffset.UTC));
    }

    private EventoOperacionalDto event(String id, String domain, Instant occurredAt) {
        return new EventoOperacionalDto(
                id, "test.event", domain, occurredAt, new ObjectMapper().createObjectNode());
    }

    private EstadoMaquinariaDto state(String id, String status, Instant updatedAt) {
        return new EstadoMaquinariaDto(id, status, "test", updatedAt);
    }
}
