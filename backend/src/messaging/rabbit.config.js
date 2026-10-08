import 'dotenv/config';

export const rabbitConfig = Object.freeze({
  enabled: process.env.RABBITMQ_ENABLED === 'true',
  url: process.env.RABBITMQ_URL || 'amqp://srmm:local_dev_only@localhost:5672',
  prefetch: Number(process.env.RABBITMQ_PREFETCH || 10),
  maxRetries: Number(process.env.RABBITMQ_MAX_RETRIES || 3),
  rental: Object.freeze({
    exchange: 'srmm.arriendos',
    queue: 'srmm.notificaciones.arriendo-creado',
    routingKey: 'arriendo.creado',
    deadLetterExchange: 'srmm.arriendos.dlx',
    deadLetterQueue: 'srmm.notificaciones.arriendo-creado.dlq',
    deadLetterRoutingKey: 'arriendo.creado.dead'
  })
});

export function rentalCreatedTopology(config = rabbitConfig) {
  return config.rental;
}
