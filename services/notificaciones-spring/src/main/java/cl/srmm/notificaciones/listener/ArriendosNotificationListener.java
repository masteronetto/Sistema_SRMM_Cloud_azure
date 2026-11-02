package cl.srmm.notificaciones.listener;

import cl.srmm.notificaciones.config.RabbitTopology;
import cl.srmm.notificaciones.service.NotificationEventHandler;
import cl.srmm.notificaciones.service.NotificationMessageProcessor;
import com.rabbitmq.client.Channel;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

@Component
public class ArriendosNotificationListener {

    private final NotificationEventHandler eventHandler;
    private final NotificationMessageProcessor messageProcessor;

    public ArriendosNotificationListener(
            NotificationEventHandler eventHandler,
            NotificationMessageProcessor messageProcessor
    ) {
        this.eventHandler = eventHandler;
        this.messageProcessor = messageProcessor;
    }

    @RabbitListener(queues = RabbitTopology.RENTAL_QUEUE, containerFactory = "rabbitListenerContainerFactory")
    public void consume(Message message, Channel channel) throws java.io.IOException {
        messageProcessor.process(
                message,
                channel,
                RabbitTopology.RENTAL_QUEUE,
                RabbitTopology.RENTAL_EXCHANGE,
                RabbitTopology.RENTAL_ROUTING_KEY,
                () -> eventHandler.handleRental(message)
        );
    }
}
