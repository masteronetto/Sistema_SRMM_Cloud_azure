package cl.srmm.kafka.bridge.messaging;

import cl.srmm.kafka.bridge.messaging.dto.EstadoMaquinariaDto;
import cl.srmm.kafka.bridge.messaging.dto.EventoOperacionalDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;
import org.springframework.stereotype.Component;

import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

@Component
public class KafkaEventProducer {

    private static final Logger LOGGER = LoggerFactory.getLogger(KafkaEventProducer.class);
    private static final long SEND_TIMEOUT_SECONDS = 30;

    private final KafkaTemplate<String, Object> kafkaTemplate;

    public KafkaEventProducer(KafkaTemplate<String, Object> kafkaTemplate) {
        this.kafkaTemplate = kafkaTemplate;
    }

    public void publish(MappedRabbitEvent event) {
        EventoOperacionalDto operational = event.operationalEvent();
        send(EventTopics.OPERATIONAL_EVENTS, event.operationalKey(), operational, operational.eventId());

        EstadoMaquinariaDto state = event.machineryState();
        if (state != null) {
            send(EventTopics.MACHINERY_STATE, state.idMaquinaria(), state, operational.eventId());
        }
    }

    private void send(String topic, String key, Object payload, String eventId) {
        try {
            SendResult<String, Object> result = kafkaTemplate.send(topic, key, payload)
                    .get(SEND_TIMEOUT_SECONDS, TimeUnit.SECONDS);
            LOGGER.info("Kafka event published. eventId={} topic={} key={} partition={} offset={}",
                    eventId, topic, key,
                    result.getRecordMetadata().partition(), result.getRecordMetadata().offset());
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new KafkaPublishException("Kafka publish interrupted for eventId=" + eventId, exception);
        } catch (ExecutionException | TimeoutException exception) {
            LOGGER.error("Kafka publish failed. eventId={} topic={} key={}", eventId, topic, key, exception);
            throw new KafkaPublishException("Kafka publish failed for eventId=" + eventId, exception);
        }
    }

    public static class KafkaPublishException extends RuntimeException {
        public KafkaPublishException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
