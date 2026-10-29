package cl.srmm.notificaciones.listener;

import cl.srmm.notificaciones.config.RabbitTopology;
import cl.srmm.notificaciones.service.NotificationEventHandler;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

@Component
public class MantenimientosNotificationListener {

    private final NotificationEventHandler eventHandler;

    public MantenimientosNotificationListener(NotificationEventHandler eventHandler) {
        this.eventHandler = eventHandler;
    }

    @RabbitListener(queues = RabbitTopology.MAINTENANCE_QUEUE, containerFactory = "rabbitListenerContainerFactory")
    public void consume(Message message) {
        eventHandler.handleMaintenance(message);
    }
}
