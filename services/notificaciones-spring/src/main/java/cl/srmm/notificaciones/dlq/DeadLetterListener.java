package cl.srmm.notificaciones.dlq;

import cl.srmm.notificaciones.config.RabbitTopology;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(prefix = "srmm.dlq-listener", name = "enabled", havingValue = "true", matchIfMissing = true)
public class DeadLetterListener {

    private static final Logger log = LoggerFactory.getLogger(DeadLetterListener.class);

    private final DeadLetterDescriber describer;

    public DeadLetterListener(DeadLetterDescriber describer) {
        this.describer = describer;
    }

    @RabbitListener(
            queues = {RabbitTopology.RENTAL_DLQ, RabbitTopology.LOGISTICS_DLQ, RabbitTopology.MAINTENANCE_DLQ},
            ackMode = "AUTO")
    public void onDeadLetter(Message message) {
        try {
            DeadLetterInfo info = describer.describe(message);
            log.warn("Mensaje no entregado en DLQ: id={} cola={} motivo={} muertes={}",
                    info.eventId(), info.queue(), info.reason(), info.count());
        } catch (RuntimeException ex) {
            log.error("No se pudo describir un mensaje de la DLQ; se descarta para no bloquear la cola", ex);
        }
    }
}