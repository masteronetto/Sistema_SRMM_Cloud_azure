package cl.srmm.kafka.analitica.service;

import cl.srmm.kafka.bridge.messaging.dto.EstadoMaquinariaDto;
import cl.srmm.kafka.bridge.messaging.dto.EventoOperacionalDto;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.TreeMap;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentSkipListMap;
import java.util.concurrent.atomic.LongAdder;

@Service
public class EventoAnaliticaService {

    private final Duration window;
    private final Clock clock;
    private final Map<String, ConcurrentSkipListMap<Instant, LongAdder>> eventTimesByDomain =
            new ConcurrentHashMap<>();
    private final Map<String, EstadoMaquinariaDto> lastStateByMachinery = new ConcurrentHashMap<>();

    @Autowired
    public EventoAnaliticaService(
            @Value("${srmm.kafka.analytics.window-duration:PT5M}") Duration window
    ) {
        this(window, Clock.systemUTC());
    }

    EventoAnaliticaService(Duration window, Clock clock) {
        if (window.isZero() || window.isNegative()) {
            throw new IllegalArgumentException("La ventana de analítica debe ser positiva.");
        }
        this.window = window;
        this.clock = clock;
    }

    public void registrarEventoOperacional(EventoOperacionalDto event) {
        if (event == null || event.dominio() == null || event.dominio().isBlank() || event.occurredAt() == null) {
            throw new IllegalArgumentException("El evento operacional requiere dominio y occurredAt.");
        }
        eventTimesByDomain
                .computeIfAbsent(event.dominio(), ignored -> new ConcurrentSkipListMap<>())
                .computeIfAbsent(event.occurredAt(), ignored -> new LongAdder())
                .increment();
    }

    public void registrarEstadoMaquinaria(EstadoMaquinariaDto state) {
        if (state == null || state.idMaquinaria() == null || state.idMaquinaria().isBlank()
                || state.updatedAt() == null) {
            throw new IllegalArgumentException("El estado requiere idMaquinaria y updatedAt.");
        }
        lastStateByMachinery.compute(state.idMaquinaria(), (id, current) ->
                current == null || !state.updatedAt().isBefore(current.updatedAt()) ? state : current);
    }

    public AnalyticsSummary resumen() {
        Instant now = clock.instant();
        Instant cutoff = now.minus(window);
        Map<String, Long> counts = new TreeMap<>();
        eventTimesByDomain.forEach((domain, eventTimes) -> {
            eventTimes.headMap(cutoff, false).clear();
            long count = eventTimes.subMap(cutoff, true, now, true)
                    .values()
                    .stream()
                    .mapToLong(LongAdder::sum)
                    .sum();
            counts.put(domain, count);
        });

        return new AnalyticsSummary(
                now,
                cutoff,
                window.toSeconds(),
                Map.copyOf(counts),
                Map.copyOf(new TreeMap<>(lastStateByMachinery)));
    }
}
