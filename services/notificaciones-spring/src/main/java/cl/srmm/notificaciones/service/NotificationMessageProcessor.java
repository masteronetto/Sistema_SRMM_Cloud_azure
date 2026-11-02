package cl.srmm.notificaciones.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.rabbitmq.client.AMQP;
import com.rabbitmq.client.Channel;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.core.Message;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

@Component
public class NotificationMessageProcessor {

    private static final Logger LOGGER = LoggerFactory.getLogger(NotificationMessageProcessor.class);
    private static final String RETRY_HEADER = "x-srmm-retry-count";
    private static final int MAX_ATTEMPTS = 3;

    private final ObjectMapper objectMapper;

    public NotificationMessageProcessor(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public void process(
            Message message,
            Channel channel,
            String queue,
            String exchange,
            String routingKey,
            Runnable handler
    ) throws IOException {
        long deliveryTag = message.getMessageProperties().getDeliveryTag();
        try {
            handler.run();
            channel.basicAck(deliveryTag, false);
        } catch (NonRecoverableNotificationException exception) {
            rejectToDeadLetter(message, channel, queue, deliveryTag, exception);
        } catch (TransientNotificationException exception) {
            retryOrReject(message, channel, queue, exchange, routingKey, deliveryTag, exception);
        } catch (RuntimeException exception) {
            LOGGER.error("Error no clasificado durante el consumo; se enviará el mensaje a DLQ. queue={}, reason={}",
                    queue, exception.getMessage(), exception);
            rejectToDeadLetter(message, channel, queue, deliveryTag, exception);
        }
    }

    private void retryOrReject(
            Message message,
            Channel channel,
            String queue,
            String exchange,
            String routingKey,
            long deliveryTag,
            TransientNotificationException exception
    ) throws IOException {
        int retryCount = retryCount(message);
        if (retryCount >= MAX_ATTEMPTS - 1) {
            rejectToDeadLetter(message, channel, queue, deliveryTag, exception);
            return;
        }

        var properties = message.getMessageProperties();
        Map<String, Object> headers = new HashMap<>(properties.getHeaders());
        headers.put(RETRY_HEADER, retryCount + 1);
        var publishProperties = new AMQP.BasicProperties.Builder()
                .contentType(properties.getContentType())
                .contentEncoding(properties.getContentEncoding())
                .headers(headers)
                .deliveryMode(2)
                .correlationId(properties.getCorrelationId())
                .messageId(properties.getMessageId())
                .build();

        channel.basicPublish(exchange, routingKey, publishProperties, message.getBody());
        channel.basicAck(deliveryTag, false);
        LOGGER.warn("Mensaje transitorio reencolado para reintento. messageId={}, queue={}, attempt={}, reason={}",
                messageId(message), queue, retryCount + 2, exception.getMessage());
    }

    private void rejectToDeadLetter(
            Message message,
            Channel channel,
            String queue,
            long deliveryTag,
            RuntimeException exception
    ) throws IOException {
        channel.basicNack(deliveryTag, false, false);
        LOGGER.warn("Mensaje rechazado para envío a DLQ. messageId={}, queue={}, reason={}",
                messageId(message), queue, exception.getMessage());
    }

    private int retryCount(Message message) {
        Object value = message.getMessageProperties().getHeaders().get(RETRY_HEADER);
        if (value == null) {
            return 0;
        }
        if (value instanceof Number number && number.intValue() >= 0) {
            return number.intValue();
        }
        if (value instanceof String string) {
            try {
                int parsed = Integer.parseInt(string);
                return parsed >= 0 ? parsed : MAX_ATTEMPTS;
            } catch (NumberFormatException ignored) {
                return MAX_ATTEMPTS;
            }
        }
        return MAX_ATTEMPTS;
    }

    private String messageId(Message message) {
        String messageId = message.getMessageProperties().getMessageId();
        if (messageId != null && !messageId.isBlank()) {
            return messageId;
        }
        try {
            JsonNode event = objectMapper.readTree(message.getBody());
            if (event != null) {
                String eventId = event.path("eventId").asText();
                if (!eventId.isBlank()) {
                    return eventId;
                }
            }
        } catch (IOException ignored) {
            return "delivery-" + message.getMessageProperties().getDeliveryTag();
        }
        return "delivery-" + message.getMessageProperties().getDeliveryTag();
    }
}
