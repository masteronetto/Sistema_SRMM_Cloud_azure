package cl.srmm.kafka.analitica.logging;

import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.slf4j.MDC;

import java.util.Map;

public final class KafkaRecordMdc {

    private KafkaRecordMdc() {
    }

    public static void withRecord(ConsumerRecord<?, ?> record, Exception exception, Runnable action) {
        Map<String, String> previous = MDC.getCopyOfContextMap();
        try {
            MDC.put("topic", record.topic());
            MDC.put("partition", Integer.toString(record.partition()));
            MDC.put("offset", Long.toString(record.offset()));
            MDC.put("key", String.valueOf(record.key()));
            MDC.put("reason", reason(exception));
            action.run();
        } finally {
            if (previous == null) {
                MDC.clear();
            } else {
                MDC.setContextMap(previous);
            }
        }
    }

    public static String reason(Throwable throwable) {
        Throwable cause = throwable;
        while (cause.getCause() != null && cause.getCause() != cause) {
            cause = cause.getCause();
        }
        String message = cause.getMessage();
        return message == null || message.isBlank() ? cause.getClass().getSimpleName() : message;
    }
}
