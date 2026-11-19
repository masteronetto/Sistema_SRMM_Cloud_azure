package cl.srmm.kafka.bridge.dlq;

import cl.srmm.kafka.bridge.messaging.BridgeRabbitTopology;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(prefix = "srmm.dlq-listener", name = "enabled", havingValue = "true", matchIfMissing = true)
public class DeadLetterListener {

    private static final Logger LOGGER = LoggerFactory.getLogger(DeadLetterListener.class);

    private final DeadLetterDescriber describer;

    public DeadLetterListener(DeadLetterDescriber describer) {
        this.describer = describer;
    }

    @RabbitListener(
            queues = {BridgeRabbitTopology.RENTAL_DLQ, BridgeRabbitTopology.LOGISTICS_DLQ,
                    BridgeRabbitTopology.MAINTENANCE_DLQ},
            ackMode = "AUTO")
    public void onDeadLetter(Message message) {
        try {
            DeadLetterInfo info = describer.describe(message);
            LOGGER.warn("Mensaje no entregado en DLQ: id={} cola={} motivo={} muertes={}",
                    info.eventId(), info.queue(), info.reason(), info.count());
        } catch (RuntimeException exception) {
            LOGGER.error("No se pudo describir un mensaje de la DLQ; se descarta para no bloquear la cola",
                    exception);
        }
    }
}