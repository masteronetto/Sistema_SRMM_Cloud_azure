package cl.srmm.kafka.analitica.consumer;

import cl.srmm.kafka.analitica.service.EventoAnaliticaService;
import cl.srmm.kafka.bridge.messaging.dto.EstadoMaquinariaDto;
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
public class AnaliticaConsumer {

    private static final Logger LOGGER = LoggerFactory.getLogger(AnaliticaConsumer.class);

    private final EventoAnaliticaService service;
    private final Validator validator;

    public AnaliticaConsumer(EventoAnaliticaService service, Validator validator) {
        this.service = service;
        this.validator = validator;
    }

    @KafkaListener(
            topics = {
                    "${srmm.kafka.topics.operational-events}",
                    "${srmm.kafka.topics.machinery-state}"
            },
            groupId = "${srmm.kafka.consumer.analytics-group-id}",
            concurrency = "${srmm.kafka.consumer.analytics-concurrency}")
    public void consume(ConsumerRecord<String, Object> record, Acknowledgment acknowledgment) {
        Object value = record.value();
        if (value instanceof EventoOperacionalDto event) {
            validate(event);
            service.registrarEventoOperacional(event);
            LOGGER.info("Analytics operational event consumed. eventId={} domain={} topic={} partition={} offset={}",
                    event.eventId(), event.dominio(), record.topic(), record.partition(), record.offset());
        } else if (value instanceof EstadoMaquinariaDto state) {
            validate(state);
            service.registrarEstadoMaquinaria(state);
            LOGGER.info("Analytics machinery state consumed. machineryId={} state={} topic={} partition={} offset={}",
                    state.idMaquinaria(), state.estado(), record.topic(), record.partition(), record.offset());
        } else {
            if (value == null) {
                throw InvalidKafkaPayloadException.fromRecord(record, "El mensaje Kafka no contiene payload.");
            }
            String valueType = value.getClass().getName();
            throw new InvalidKafkaPayloadException("Tipo de valor inesperado en topic analítico: " + valueType);
        }
        acknowledgment.acknowledge();
    }

    private void validate(Object payload) {
        Set<ConstraintViolation<Object>> violations = validator.validate(payload);
        if (!violations.isEmpty()) {
            String reason = violations.stream()
                    .map(violation -> violation.getPropertyPath() + " " + violation.getMessage())
                    .sorted()
                    .collect(Collectors.joining("; "));
            throw new InvalidKafkaPayloadException("Payload inválido: " + reason);
        }
    }
}
