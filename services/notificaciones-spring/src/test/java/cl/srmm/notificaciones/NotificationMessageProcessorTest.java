package cl.srmm.notificaciones;

import cl.srmm.notificaciones.service.NonRecoverableNotificationException;
import cl.srmm.notificaciones.service.NotificationMessageProcessor;
import cl.srmm.notificaciones.service.TransientNotificationException;
import com.rabbitmq.client.AMQP;
import com.rabbitmq.client.Channel;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageProperties;

import java.nio.charset.StandardCharsets;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.ArgumentMatchers.argThat;

class NotificationMessageProcessorTest {

    private NotificationMessageProcessor processor;
    private Channel channel;

    @BeforeEach
    void setUp() {
        processor = new NotificationMessageProcessor(new ObjectMapper());
        channel = mock(Channel.class);
    }

    @Test
    void acknowledgesSuccessfullyProcessedMessage() throws Exception {
        Message message = messageWithDeliveryTag(41);

        processor.process(message, channel, "queue", "exchange", "routing.key", () -> {});

        verify(channel).basicAck(41, false);
        verify(channel, never()).basicNack(41, false, false);
        verifyNoMoreInteractions(channel);
    }

    @Test
    void rejectsNonRecoverableMessageWithoutRequeue() throws Exception {
        Message message = messageWithDeliveryTag(42);

        processor.process(message, channel, "queue", "exchange", "routing.key",
                () -> { throw new NonRecoverableNotificationException("invalid event"); });

        verify(channel).basicNack(42, false, false);
        verify(channel, never()).basicAck(42, false);
        verifyNoMoreInteractions(channel);
    }

    @Test
    void republishesTransientFailureWithRetryHeaderThenAcknowledgesOriginal() throws Exception {
        Message message = messageWithDeliveryTag(43);

        processor.process(message, channel, "queue", "exchange", "routing.key",
                () -> { throw new TransientNotificationException("temporary failure"); });

        verify(channel).basicPublish(
                eq("exchange"),
                eq("routing.key"),
                argThat(properties -> Integer.valueOf(1).equals(
                        properties.getHeaders().get("x-srmm-retry-count"))),
                eq(message.getBody())
        );
        verify(channel).basicAck(43, false);
        verify(channel, never()).basicNack(43, false, false);
        verifyNoMoreInteractions(channel);
    }

    @Test
    void sendsExhaustedTransientFailureToDeadLetterQueue() throws Exception {
        MessageProperties properties = new MessageProperties();
        properties.setDeliveryTag(44);
        properties.setHeader("x-srmm-retry-count", 2);
        Message message = new Message("{}".getBytes(StandardCharsets.UTF_8), properties);

        processor.process(message, channel, "queue", "exchange", "routing.key",
                () -> { throw new TransientNotificationException("still unavailable"); });

        verify(channel).basicNack(44, false, false);
        verify(channel, never()).basicAck(44, false);
        verify(channel, never()).basicPublish(any(), any(), any(AMQP.BasicProperties.class), any());
        verifyNoMoreInteractions(channel);
    }

    private Message messageWithDeliveryTag(long deliveryTag) {
        MessageProperties properties = new MessageProperties();
        properties.setDeliveryTag(deliveryTag);
        properties.setHeaders(Map.of());
        return new Message("{\"eventId\":\"test-event\"}".getBytes(StandardCharsets.UTF_8), properties);
    }
}
