package cl.srmm.kafka.bridge.messaging;

import cl.srmm.kafka.bridge.messaging.dto.EstadoMaquinariaDto;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

class RabbitEventMapperTest {

    private RabbitEventMapper mapper;

    @BeforeEach
    void setUp() {
        mapper = new RabbitEventMapper(new ObjectMapper());
    }

    @Test
    void mapsLogisticsEventAndMachineryStateWithBusinessKey() {
        MappedRabbitEvent mapped = map("""
                {
                  "eventId": "evt-10",
                  "eventType": "logistica.estado-cambiado",
                  "occurredAt": "2026-11-16T12:00:00Z",
                  "data": {
                    "id_evento": 10,
                    "maquinaria_id_maquina": 22,
                    "estado_evento": "En Ruta"
                  }
                }
                """, BridgeRabbitTopology.LOGISTICS_ROUTING_KEY, "logistica", "id_evento");

        assertEquals("evt-10", mapped.operationalEvent().eventId());
        assertEquals("logistica", mapped.operationalEvent().dominio());
        assertEquals("logistica.estado-cambiado", mapped.operationalEvent().tipo());
        assertEquals("logistica:10", mapped.operationalKey());
        assertEquals("22", mapped.machineryState().idMaquinaria());
        assertEquals("En Ruta", mapped.machineryState().estado());
        assertEquals(Instant.parse("2026-11-16T12:00:00Z"), mapped.machineryState().updatedAt());
    }

    @Test
    void doesNotEmitMachineryStateWhenLogisticsPayloadHasNoMachineryId() {
        MappedRabbitEvent mapped = map("""
                {
                  "eventId": "evt-11",
                  "eventType": "logistica.estado-cambiado",
                  "occurredAt": "2026-11-16T12:00:00Z",
                  "data": {
                    "id_evento": 11,
                    "maquinaria_id_maquina": null,
                    "estado_evento": "Pendiente"
                  }
                }
                """, BridgeRabbitTopology.LOGISTICS_ROUTING_KEY, "logistica", "id_evento");

        assertNull(mapped.machineryState());
        assertEquals("logistica:11", mapped.operationalKey());
    }

    @Test
    void mapsMaintenanceIncidentStateUsingMachineryIdFromPayload() {
        MappedRabbitEvent mapped = map("""
                {
                  "eventId": "evt-12",
                  "eventType": "mantenimiento.incidencia-critica",
                  "occurredAt": "2026-11-16T12:00:00Z",
                  "data": {
                    "id_incidencia": 12,
                    "maquinaria_id_maquina": 33,
                    "estado": "Pendiente"
                  }
                }
                """, BridgeRabbitTopology.MAINTENANCE_ROUTING_KEY, "mantenimientos", "id_incidencia");

        assertEquals("mantenimientos:12", mapped.operationalKey());
        assertEquals(new EstadoMaquinariaDto(
                "33", "Pendiente", "mantenimientos", Instant.parse("2026-11-16T12:00:00Z")),
                mapped.machineryState());
    }

    @Test
    void rejectsEventWithoutRequiredBusinessId() {
        InvalidRabbitEventException exception = assertThrows(InvalidRabbitEventException.class, () ->
                map("""
                        {
                          "eventId": "evt-13",
                          "eventType": "arriendo.creado",
                          "occurredAt": "2026-11-16T12:00:00Z",
                          "data": {}
                        }
                        """, BridgeRabbitTopology.RENTAL_ROUTING_KEY, "arriendos", "id_contrato"));

        assertEquals("evt-13", exception.getEventId());
    }

    @Test
    void rejectsEmptyOrNonObjectJsonAsInvalid() {
        assertThrows(InvalidRabbitEventException.class, () ->
                mapper.map(new byte[0], BridgeRabbitTopology.RENTAL_ROUTING_KEY, "arriendos", "id_contrato"));
        assertThrows(InvalidRabbitEventException.class, () ->
                map("null", BridgeRabbitTopology.RENTAL_ROUTING_KEY, "arriendos", "id_contrato"));
    }

    private MappedRabbitEvent map(
            String json,
            String eventType,
            String domain,
            String businessIdField
    ) {
        return mapper.map(json.getBytes(StandardCharsets.UTF_8), eventType, domain, businessIdField);
    }
}
