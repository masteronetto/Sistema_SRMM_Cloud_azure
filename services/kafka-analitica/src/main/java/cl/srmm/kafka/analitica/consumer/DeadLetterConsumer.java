package cl.srmm.kafka.analitica.consumer;

import cl.srmm.kafka.analitica.logging.KafkaRecordMdc;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.support.Acknowledgment;
import org.springframework.kafka.support.KafkaHeaders;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;

@Component
public class DeadLetterConsumer {

    private static final Logger LOGGER = LoggerFactory.getLogger(DeadLetterConsumer.class);

    @KafkaListener(
            topics = {
                    "${srmm.kafka.topics.operational-dlt}",
                    "${srmm.kafka.topics.machinery-state-dlt}"
            },
            groupId = "${srmm.kafka.consumer.dead-letter-group-id}",
            containerFactory = "deadLetterKafkaListenerContainerFactory")
    public void consume(ConsumerRecord<String, byte[]> record, Acknowledgment acknowledgment) {
        String reason = header(record, KafkaHeaders.DLT_EXCEPTION_MESSAGE);
        Exception context = new IllegalStateException(reason);
        KafkaRecordMdc.withRecord(record, context, () ->
                LOGGER.error("Dead-letter record received. topic={} partition={} offset={} key={} reason={} payloadBytes={}",
                        record.topic(), record.partition(), record.offset(), record.key(), reason,
                        record.value() == null ? 0 : record.value().length));
        acknowledgment.acknowledge();
    }

    private String header(ConsumerRecord<?, ?> record, String name) {
        var header = record.headers().lastHeader(name);
        return header == null
                ? "No error message header"
                : new String(header.value(), StandardCharsets.UTF_8);
    }
}
