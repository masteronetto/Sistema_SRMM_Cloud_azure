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
  }),
  logistics: Object.freeze({
    exchange: 'srmm.logistica',
    queue: 'srmm.notificaciones.logistica-estado',
    routingKey: 'logistica.estado-cambiado',
    deadLetterExchange: 'srmm.logistica.dlx',
    deadLetterQueue: 'srmm.notificaciones.logistica-estado.dlq',
    deadLetterRoutingKey: 'logistica.estado-cambiado.dead'
  }),
  maintenance: Object.freeze({
    exchange: 'srmm.mantenimientos',
    queue: 'srmm.tickets.incidencia-critica',
    routingKey: 'mantenimiento.incidencia-critica',
    deadLetterExchange: 'srmm.mantenimientos.dlx',
    deadLetterQueue: 'srmm.tickets.incidencia-critica.dlq',
    deadLetterRoutingKey: 'mantenimiento.incidencia-critica.dead'
  })
});

export function rentalCreatedTopology(config = rabbitConfig) {
  return config.rental;
}

export function logisticsStateTopology(config = rabbitConfig) {
  return config.logistics;
}

export function criticalIncidentTopology(config = rabbitConfig) {
  return config.maintenance;
}
