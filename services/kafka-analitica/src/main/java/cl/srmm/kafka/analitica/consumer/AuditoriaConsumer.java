package cl.srmm.kafka.analitica.consumer;

import cl.srmm.kafka.bridge.messaging.dto.EventoOperacionalDto;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.support.Acknowledgment;
import org.springframework.stereotype.Component;

import java.util.Set;
import java.util.stream.Collectors;

@Component
public class AuditoriaConsumer {

    private static final Logger LOGGER = LoggerFactory.getLogger(AuditoriaConsumer.class);

    private final Validator validator;

    public AuditoriaConsumer(Validator validator) {
        this.validator = validator;
    }

    @KafkaListener(
            topics = "${srmm.kafka.topics.operational-events}",
            groupId = "${srmm.kafka.consumer.audit-group-id}")
    public void consume(ConsumerRecord<String, Object> record, Acknowledgment acknowledgment) {
        if (!(record.value() instanceof EventoOperacionalDto event)) {
            Object value = record.value();
            if (value == null) {
                throw InvalidKafkaPayloadException.fromRecord(record, "El mensaje Kafka no contiene payload.");
            }
            String valueType = value.getClass().getName();
            throw new InvalidKafkaPayloadException(
                    "Tipo de valor inesperado en topic de auditoría: " + valueType);
        }
        Set<ConstraintViolation<EventoOperacionalDto>> violations = validator.validate(event);
        if (!violations.isEmpty()) {
            String reason = violations.stream()
                    .map(violation -> violation.getPropertyPath() + " " + violation.getMessage())
                    .sorted()
                    .collect(Collectors.joining("; "));
            throw new InvalidKafkaPayloadException("Payload inválido: " + reason);
        }
        LOGGER.info("Audit fan-out event. eventId={} domain={} key={} topic={} partition={} offset={}",
                event.eventId(), event.dominio(), record.key(),
                record.topic(), record.partition(), record.offset());
        acknowledgment.acknowledge();
    }
}
