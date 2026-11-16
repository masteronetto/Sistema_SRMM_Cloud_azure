package cl.srmm.kafka.analitica.config;

import cl.srmm.kafka.analitica.consumer.InvalidKafkaPayloadException;
import cl.srmm.kafka.analitica.logging.KafkaRecordMdc;
import cl.srmm.kafka.bridge.messaging.dto.EstadoMaquinariaDto;
import cl.srmm.kafka.bridge.messaging.dto.EventoOperacionalDto;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.common.TopicPartition;
import org.apache.kafka.common.serialization.ByteArrayDeserializer;
import org.apache.kafka.common.serialization.ByteArraySerializer;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.apache.kafka.common.serialization.StringSerializer;
import org.apache.kafka.common.serialization.Serializer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.core.ConsumerFactory;
import org.springframework.kafka.core.DefaultKafkaConsumerFactory;
import org.springframework.kafka.core.DefaultKafkaProducerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.core.ProducerFactory;
import org.springframework.kafka.listener.ConsumerRecordRecoverer;
import org.springframework.kafka.listener.DeadLetterPublishingRecoverer;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.kafka.listener.RetryListener;
import org.springframework.kafka.support.ExponentialBackOffWithMaxRetries;
import org.springframework.kafka.support.KafkaHeaders;
import org.springframework.kafka.support.serializer.DelegatingByTypeSerializer;
import org.springframework.kafka.support.serializer.DeserializationException;
import org.springframework.kafka.support.serializer.ErrorHandlingDeserializer;
import org.springframework.kafka.support.serializer.JsonDeserializer;
import org.springframework.kafka.support.serializer.JsonSerializer;
import org.springframework.kafka.listener.ContainerProperties;

import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.apache.kafka.clients.producer.ProducerConfig.BOOTSTRAP_SERVERS_CONFIG;

@Configuration
public class KafkaConsumerConfiguration {

    @Bean
    ConsumerFactory<String, Object> kafkaConsumerFactory(
            @Value("${spring.kafka.bootstrap-servers}") String bootstrapServers,
            @Value("${srmm.kafka.consumer.analytics-group-id}") String analyticsGroupId,
            @Value("${srmm.kafka.consumer.auto-offset-reset}") String autoOffsetReset,
            @Value("${srmm.kafka.consumer.max-poll-records}") int maxPollRecords,
            @Value("${srmm.kafka.consumer.session-timeout-ms}") int sessionTimeoutMs,
            @Value("${srmm.kafka.consumer.trusted-packages}") String trustedPackages
    ) {
        Map<String, Object> properties = consumerProperties(
                bootstrapServers, analyticsGroupId, autoOffsetReset, maxPollRecords, sessionTimeoutMs);
        properties.put(JsonDeserializer.TRUSTED_PACKAGES, trustedPackages);

        ErrorHandlingDeserializer<Object> valueDeserializer =
                new ErrorHandlingDeserializer<>(new JsonDeserializer<>(Object.class));
        return new DefaultKafkaConsumerFactory<>(
                properties,
                new StringDeserializer(),
                valueDeserializer);
    }

    @Bean
    ConcurrentKafkaListenerContainerFactory<String, Object> kafkaListenerContainerFactory(
            ConsumerFactory<String, Object> kafkaConsumerFactory,
            DefaultErrorHandler kafkaErrorHandler,
            @Value("${srmm.kafka.consumer.analytics-concurrency}") int concurrency
    ) {
        ConcurrentKafkaListenerContainerFactory<String, Object> factory =
                new ConcurrentKafkaListenerContainerFactory<>();
        factory.setConsumerFactory(kafkaConsumerFactory);
        factory.setConcurrency(concurrency);
        factory.setCommonErrorHandler(kafkaErrorHandler);
        factory.getContainerProperties().setAckMode(ContainerProperties.AckMode.MANUAL);
        return factory;
    }

    @Bean
    ProducerFactory<String, Object> deadLetterProducerFactory(
            @Value("${spring.kafka.bootstrap-servers}") String bootstrapServers
    ) {
        Map<Class<?>, Serializer<?>> serializers = new LinkedHashMap<>();
        serializers.put(byte[].class, new ByteArraySerializer());
        serializers.put(EventoOperacionalDto.class, new JsonSerializer<>());
        serializers.put(EstadoMaquinariaDto.class, new JsonSerializer<>());
        serializers.put(Object.class, new JsonSerializer<>());

        Map<String, Object> properties = Map.of(BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        return new DefaultKafkaProducerFactory<>(
                properties,
                new StringSerializer(),
                new DelegatingByTypeSerializer(serializers, true));
    }

    @Bean
    KafkaTemplate<String, Object> deadLetterKafkaTemplate(
            ProducerFactory<String, Object> deadLetterProducerFactory
    ) {
        return new KafkaTemplate<>(deadLetterProducerFactory);
    }

    @Bean
    DeadLetterPublishingRecoverer deadLetterPublishingRecoverer(
            KafkaTemplate<String, Object> deadLetterKafkaTemplate
    ) {
        DeadLetterPublishingRecoverer recoverer = new DeadLetterPublishingRecoverer(
                deadLetterKafkaTemplate,
                (record, exception) -> new TopicPartition(record.topic() + ".DLT", -1));
        recoverer.setFailIfSendResultIsError(true);
        recoverer.setWaitForSendResultTimeout(Duration.ofSeconds(10));
        recoverer.setAppendOriginalHeaders(true);
        recoverer.setStripPreviousExceptionHeaders(false);
        recoverer.setLogRecoveryRecord(false);
        return recoverer;
    }

    @Bean
    DefaultErrorHandler kafkaErrorHandler(DeadLetterPublishingRecoverer deadLetterPublishingRecoverer) {
        ConsumerRecordRecoverer loggingRecoverer = (record, exception) ->
                KafkaRecordMdc.withRecord(record, exception, () -> {
                    org.slf4j.LoggerFactory.getLogger(KafkaConsumerConfiguration.class)
                            .error("Publishing failed Kafka record to DLT. topic={} partition={} offset={} key={} reason={}",
                                    record.topic(), record.partition(), record.offset(), record.key(),
                                    KafkaRecordMdc.reason(exception));
                    deadLetterPublishingRecoverer.accept(record, exception);
                });

        DefaultErrorHandler errorHandler = new DefaultErrorHandler(loggingRecoverer, retryBackOff());
        errorHandler.addNotRetryableExceptions(
                InvalidKafkaPayloadException.class,
                DeserializationException.class);
        errorHandler.setRetryListeners(new RetryListener() {
            @Override
            public void failedDelivery(
                    org.apache.kafka.clients.consumer.ConsumerRecord<?, ?> record,
                    Exception exception,
                    int deliveryAttempt
            ) {
                KafkaRecordMdc.withRecord(record, exception, () ->
                        org.slf4j.LoggerFactory.getLogger(KafkaConsumerConfiguration.class)
                                .warn("Kafka record delivery failed; retry or DLT follows. attempt={} topic={} partition={} offset={} key={} reason={}",
                                        deliveryAttempt, record.topic(), record.partition(), record.offset(),
                                        record.key(), KafkaRecordMdc.reason(exception)));
            }
        });
        return errorHandler;
    }

    static ExponentialBackOffWithMaxRetries retryBackOff() {
        ExponentialBackOffWithMaxRetries backOff = new ExponentialBackOffWithMaxRetries(3);
        backOff.setInitialInterval(1_000L);
        backOff.setMultiplier(2.0);
        return backOff;
    }

    @Bean
    ConsumerFactory<String, byte[]> deadLetterConsumerFactory(
            @Value("${spring.kafka.bootstrap-servers}") String bootstrapServers,
            @Value("${srmm.kafka.consumer.dead-letter-group-id}") String groupId,
            @Value("${srmm.kafka.consumer.auto-offset-reset}") String autoOffsetReset,
            @Value("${srmm.kafka.consumer.max-poll-records}") int maxPollRecords,
            @Value("${srmm.kafka.consumer.session-timeout-ms}") int sessionTimeoutMs
    ) {
        return new DefaultKafkaConsumerFactory<>(
                consumerProperties(bootstrapServers, groupId, autoOffsetReset, maxPollRecords, sessionTimeoutMs),
                new StringDeserializer(),
                new ByteArrayDeserializer());
    }

    @Bean
    ConcurrentKafkaListenerContainerFactory<String, byte[]> deadLetterKafkaListenerContainerFactory(
            ConsumerFactory<String, byte[]> deadLetterConsumerFactory
    ) {
        ConcurrentKafkaListenerContainerFactory<String, byte[]> factory =
                new ConcurrentKafkaListenerContainerFactory<>();
        factory.setConsumerFactory(deadLetterConsumerFactory);
        factory.getContainerProperties().setAckMode(ContainerProperties.AckMode.MANUAL);
        return factory;
    }

    private Map<String, Object> consumerProperties(
            String bootstrapServers,
            String groupId,
            String autoOffsetReset,
            int maxPollRecords,
            int sessionTimeoutMs
    ) {
        Map<String, Object> properties = new LinkedHashMap<>();
        properties.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        properties.put(ConsumerConfig.GROUP_ID_CONFIG, groupId);
        properties.put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, false);
        properties.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, autoOffsetReset);
        properties.put(ConsumerConfig.MAX_POLL_RECORDS_CONFIG, maxPollRecords);
        properties.put(ConsumerConfig.SESSION_TIMEOUT_MS_CONFIG, sessionTimeoutMs);
        return properties;
    }
}
