package cl.srmm.kafka.bridge.messaging;

import cl.srmm.kafka.bridge.messaging.dto.EstadoMaquinariaDto;
import cl.srmm.kafka.bridge.messaging.dto.EventoOperacionalDto;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.kafka.clients.producer.RecordMetadata;
import org.junit.jupiter.api.Test;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;

import java.time.Instant;
import java.util.concurrent.CompletableFuture;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class KafkaEventProducerTest {

    @Test
    void publishesOperationalAndMachineryEventsWithTheirRequiredKeys() {
        @SuppressWarnings("unchecked")
        KafkaTemplate<String, Object> template = mock(KafkaTemplate.class);
        SendResult<String, Object> sendResult = successfulSendResult();
        doReturn(CompletableFuture.completedFuture(sendResult))
                .when(template).send(eq(EventTopics.OPERATIONAL_EVENTS), eq("logistica:14"), any());
        doReturn(CompletableFuture.completedFuture(sendResult))
                .when(template).send(eq(EventTopics.MACHINERY_STATE), eq("7"), any());

        EventoOperacionalDto operational = new EventoOperacionalDto(
                "event-14", "logistica.estado-cambiado", "logistica",
                Instant.parse("2026-11-16T12:00:00Z"), new ObjectMapper().createObjectNode());
        EstadoMaquinariaDto state = new EstadoMaquinariaDto(
                "7", "En Ruta", "logistica", Instant.parse("2026-11-16T12:00:00Z"));

        new KafkaEventProducer(template).publish(new MappedRabbitEvent(operational, state, "logistica:14"));

        verify(template).send(EventTopics.OPERATIONAL_EVENTS, "logistica:14", operational);
        verify(template).send(EventTopics.MACHINERY_STATE, "7", state);
    }

    @Test
    void publishesOnlyOperationalEventWhenThereIsNoMachineryState() {
        @SuppressWarnings("unchecked")
        KafkaTemplate<String, Object> template = mock(KafkaTemplate.class);
        SendResult<String, Object> sendResult = successfulSendResult();
        doReturn(CompletableFuture.completedFuture(sendResult))
                .when(template).send(eq(EventTopics.OPERATIONAL_EVENTS), eq("logistica:15"), any());

        EventoOperacionalDto operational = new EventoOperacionalDto(
                "event-15", "logistica.estado-cambiado", "logistica",
                Instant.parse("2026-11-16T12:00:00Z"), new ObjectMapper().createObjectNode());

        new KafkaEventProducer(template).publish(new MappedRabbitEvent(operational, null, "logistica:15"));

        verify(template).send(EventTopics.OPERATIONAL_EVENTS, "logistica:15", operational);
    }

    private SendResult<String, Object> successfulSendResult() {
        @SuppressWarnings("unchecked")
        SendResult<String, Object> result = mock(SendResult.class);
        RecordMetadata metadata = mock(RecordMetadata.class);
        doReturn(0).when(metadata).partition();
        doReturn(0L).when(metadata).offset();
        doReturn(metadata).when(result).getRecordMetadata();
        return result;
    }
}
