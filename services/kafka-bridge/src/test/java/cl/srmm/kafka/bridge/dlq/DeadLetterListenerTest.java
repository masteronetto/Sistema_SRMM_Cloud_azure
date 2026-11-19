package cl.srmm.kafka.bridge.dlq;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageProperties;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;

class DeadLetterListenerTest {

    private final Message message = new Message("{}".getBytes(StandardCharsets.UTF_8), new MessageProperties());

    @Test
    void logsDeadLetterWithoutThrowing() {
        DeadLetterListener listener = new DeadLetterListener(new DeadLetterDescriber(new ObjectMapper()));

        assertDoesNotThrow(() -> listener.onDeadLetter(message));
    }

    @Test
    void doesNotPropagateExceptionsSoTheQueueIsNeverBlocked() {
        DeadLetterDescriber failing = new DeadLetterDescriber(new ObjectMapper()) {
            @Override
            public DeadLetterInfo describe(Message ignored) {
                throw new IllegalStateException("fallo simulado");
            }
        };
        DeadLetterListener listener = new DeadLetterListener(failing);

        assertDoesNotThrow(() -> listener.onDeadLetter(message));
    }
}