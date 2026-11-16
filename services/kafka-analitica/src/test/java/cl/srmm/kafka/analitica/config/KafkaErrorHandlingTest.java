package cl.srmm.kafka.analitica.config;

import cl.srmm.kafka.analitica.consumer.AnaliticaConsumer;
import cl.srmm.kafka.analitica.consumer.InvalidKafkaPayloadException;
import cl.srmm.kafka.analitica.service.EventoAnaliticaService;
import cl.srmm.kafka.bridge.messaging.dto.EventoOperacionalDto;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.apache.kafka.clients.consumer.Consumer;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.common.header.internals.RecordHeaders;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.listener.DeadLetterPublishingRecoverer;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.kafka.listener.MessageListenerContainer;
import org.springframework.kafka.support.KafkaHeaders;
import org.springframework.kafka.support.SendResult;
import org.springframework.kafka.support.ExponentialBackOffWithMaxRetries;
import org.springframework.util.backoff.BackOffExecution;
import org.springframework.kafka.support.serializer.ErrorHandlingDeserializer;
import org.springframework.kafka.support.serializer.JsonDeserializer;
import org.springframework.kafka.support.serializer.SerializationUtils;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

class KafkaErrorHandlingTest {

    private static final String TOPIC = "srmm.eventos-operacionales";
    private static final ConsumerRecord<String, Object> RECORD = new ConsumerRecord<>(
            TOPIC, 1, 42L, "arriendos:7", validEvent());

    private static final jakarta.validation.ValidatorFactory VALIDATOR_FACTORY =
            Validation.buildDefaultValidatorFactory();
    private static final Validator VALIDATOR = VALIDATOR_FACTORY.getValidator();

    private EventoAnaliticaService service;
    private AnaliticaConsumer listener;
    private KafkaTemplate<String, Object> dltTemplate;
    private DefaultErrorHandler errorHandler;
    private Consumer<String, Object> consumer;
    private MessageListenerContainer container;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        service = mock(EventoAnaliticaService.class);
        listener = new AnaliticaConsumer(service, VALIDATOR);
        dltTemplate = mock(KafkaTemplate.class);
        mockSuccessfulDltSend();
        errorHandler = errorHandler(dltTemplate);
        consumer = mock(Consumer.class);
        container = mock(MessageListenerContainer.class);
    }

    @AfterAll
    static void closeValidator() {
        VALIDATOR_FACTORY.close();
    }

    @Test
    void acknowledgesValidEvent() {
        var acknowledgment = mock(org.springframework.kafka.support.Acknowledgment.class);

        listener.consume(RECORD, acknowledgment);

        verify(service).registrarEventoOperacional(validEvent());
        verify(acknowledgment).acknowledge();
    }

    @Test
    void productionBackoffUsesThreeRetriesStartingAtOneSecondAndDoubles() {
        BackOffExecution execution = KafkaConsumerConfiguration.retryBackOff().start();

        assertEquals(1_000L, execution.nextBackOff());
        assertEquals(2_000L, execution.nextBackOff());
        assertEquals(4_000L, execution.nextBackOff());
        assertEquals(BackOffExecution.STOP, execution.nextBackOff());
    }

    @Test
    @SuppressWarnings("unchecked")
    void malformedJsonIsWrappedAndSentDirectlyToDlt() {
        ErrorHandlingDeserializer<Object> deserializer = new ErrorHandlingDeserializer<>(
                new JsonDeserializer<>(Object.class));
        deserializer.configure(Map.of(
                JsonDeserializer.TRUSTED_PACKAGES,
                "cl.srmm.kafka.bridge.messaging.dto"), false);
        RecordHeaders headers = new RecordHeaders();
        byte[] malformedJson = "{malformed".getBytes(StandardCharsets.UTF_8);
        Object value = deserializer.deserialize(TOPIC, headers, malformedJson);

        assertNull(value);
        assertNotNull(headers.lastHeader(SerializationUtils.VALUE_DESERIALIZER_EXCEPTION_HEADER));
        ConsumerRecord<String, Object> record = new ConsumerRecord<>(
                TOPIC, 1, 43L, "arriendos:8", value);
        headers.forEach(record.headers()::add);
        InvalidKafkaPayloadException exception = assertThrows(
                InvalidKafkaPayloadException.class,
                () -> listener.consume(record, mock(org.springframework.kafka.support.Acknowledgment.class)));
        assertTrue(exception.getMessage().contains("JSON inválido"));

        assertTrue(errorHandler.handleOne(exception, record, consumer, container));
        var captor = org.mockito.ArgumentCaptor.forClass(ProducerRecord.class);
        verify(dltTemplate).send(captor.capture());
        ProducerRecord<?, ?> dltRecord = captor.getValue();
        assertEquals(TOPIC + ".DLT", dltRecord.topic());
        assertArrayEquals(malformedJson, (byte[]) dltRecord.value());
        assertNotNull(dltRecord.headers().lastHeader(KafkaHeaders.DLT_EXCEPTION_MESSAGE));
    }

    @Test
    void beanValidationFailureIsSentDirectlyToDlt() {
        EventoOperacionalDto invalidEvent = new EventoOperacionalDto(
                "", "arriendo.creado", "arriendos",
                Instant.parse("2026-11-16T12:00:00Z"), null);
        ConsumerRecord<String, Object> record = new ConsumerRecord<>(
                TOPIC, 1, 44L, "arriendos:", invalidEvent);

        InvalidKafkaPayloadException exception = assertThrows(
                InvalidKafkaPayloadException.class,
                () -> listener.consume(record, mock(org.springframework.kafka.support.Acknowledgment.class)));

        assertTrue(errorHandler.handleOne(exception, record, consumer, container));
        verify(dltTemplate).send(any(ProducerRecord.class));
    }

    @Test
    void transientFailureCanRecoverBeforeItIsSentToDlt() {
        var acknowledgment = mock(org.springframework.kafka.support.Acknowledgment.class);
        RuntimeException transientFailure = new IllegalStateException("temporary service failure");
        org.mockito.Mockito.doThrow(transientFailure)
                .doNothing()
                .when(service).registrarEventoOperacional(any(EventoOperacionalDto.class));

        RuntimeException firstAttempt = assertThrows(RuntimeException.class,
                () -> listener.consume(RECORD, acknowledgment));
        assertFalse(errorHandler.handleOne(firstAttempt, RECORD, consumer, container));

        listener.consume(RECORD, acknowledgment);

        verify(acknowledgment).acknowledge();
        verify(dltTemplate, never()).send(any(ProducerRecord.class));
    }

    @Test
    @SuppressWarnings("unchecked")
    void exhaustedTransientRetriesPublishToTopicDltWithErrorHeaders() {
        mockSuccessfulDltSend();
        RuntimeException failure = new IllegalStateException("persistent failure");
        boolean recovered = false;
        for (int attempt = 0; attempt < 4; attempt++) {
            recovered = errorHandler.handleOne(failure, RECORD, consumer, container);
        }

        assertTrue(recovered);
        var captor = org.mockito.ArgumentCaptor.forClass(ProducerRecord.class);
        verify(dltTemplate).send(captor.capture());
        ProducerRecord<?, ?> dltRecord = captor.getValue();
        assertTrue(dltRecord.topic().equals(TOPIC + ".DLT"));
        assertNotNull(dltRecord.headers().lastHeader(KafkaHeaders.DLT_EXCEPTION_MESSAGE));
    }

    private DefaultErrorHandler errorHandler(KafkaTemplate<String, Object> template) {
        DeadLetterPublishingRecoverer recoverer =
                new KafkaConsumerConfiguration().deadLetterPublishingRecoverer(template);
        recoverer.setVerifyPartition(false);
        DefaultErrorHandler handler = new KafkaConsumerConfiguration().kafkaErrorHandler(recoverer);
        handler.setBackOffFunction((record, exception) -> {
            ExponentialBackOffWithMaxRetries backOff = new ExponentialBackOffWithMaxRetries(3);
            backOff.setInitialInterval(1);
            backOff.setMultiplier(2.0);
            return backOff;
        });
        return handler;
    }

    private void mockSuccessfulDltSend() {
        @SuppressWarnings("unchecked")
        SendResult<String, Object> result = mock(SendResult.class);
        doReturn(CompletableFuture.completedFuture(result))
                .when(dltTemplate).send(any(ProducerRecord.class));
    }

    private static EventoOperacionalDto validEvent() {
        return new EventoOperacionalDto(
                "event-7",
                "arriendo.creado",
                "arriendos",
                Instant.parse("2026-11-16T12:00:00Z"),
                new ObjectMapper().createObjectNode().put("id_contrato", 7));
    }
}
