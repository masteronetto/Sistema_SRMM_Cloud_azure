package cl.srmm.kafka.analitica.consumer;

import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.core.log.LogAccessor;
import org.springframework.kafka.support.serializer.DeserializationException;
import org.springframework.kafka.support.serializer.SerializationUtils;

public class InvalidKafkaPayloadException extends RuntimeException {

    public InvalidKafkaPayloadException(String message) {
        super(message);
    }

    public InvalidKafkaPayloadException(String message, Throwable cause) {
        super(message, cause);
    }

    public static InvalidKafkaPayloadException fromRecord(
            ConsumerRecord<?, ?> record,
            String fallbackMessage
    ) {
        DeserializationException exception = SerializationUtils.getExceptionFromHeader(
                record,
                SerializationUtils.VALUE_DESERIALIZER_EXCEPTION_HEADER,
                new LogAccessor(InvalidKafkaPayloadException.class));
        if (exception != null) {
            return new InvalidKafkaPayloadException(
                    "JSON inválido: " + exception.getMessage(), exception);
        }
        return new InvalidKafkaPayloadException(fallbackMessage);
    }
}
