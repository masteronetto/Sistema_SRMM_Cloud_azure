package cl.srmm.kafka.bridge.messaging;

import cl.srmm.kafka.bridge.messaging.dto.EstadoMaquinariaDto;
import cl.srmm.kafka.bridge.messaging.dto.EventoOperacionalDto;

public record MappedRabbitEvent(
        EventoOperacionalDto operationalEvent,
        EstadoMaquinariaDto machineryState,
        String operationalKey
) {
}
