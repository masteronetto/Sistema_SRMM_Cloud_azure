package cl.srmm.notificaciones.listener;

import cl.srmm.notificaciones.config.RabbitTopology;
import cl.srmm.notificaciones.service.NotificationEventHandler;
import cl.srmm.notificaciones.service.NotificationMessageProcessor;
import com.rabbitmq.client.Channel;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

@Component
public class MantenimientosNotificationListener {

    private final NotificationEventHandler eventHandler;
    private final NotificationMessageProcessor messageProcessor;

    public MantenimientosNotificationListener(
            NotificationEventHandler eventHandler,
            NotificationMessageProcessor messageProcessor
    ) {
        this.eventHandler = eventHandler;
        this.messageProcessor = messageProcessor;
    }

    @RabbitListener(queues = RabbitTopology.MAINTENANCE_QUEUE, containerFactory = "rabbitListenerContainerFactory")
    public void consume(Message message, Channel channel) throws java.io.IOException {
        messageProcessor.process(
                message,
                channel,
                RabbitTopology.MAINTENANCE_QUEUE,
                RabbitTopology.MAINTENANCE_EXCHANGE,
                RabbitTopology.MAINTENANCE_ROUTING_KEY,
                () -> eventHandler.handleMaintenance(message)
        );
    }
}
