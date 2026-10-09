import 'dotenv/config';
import amqp from 'amqplib';

const config = {
  url: process.env.RABBITMQ_URL || 'amqp://srmm:local_dev_only@localhost:5672',
  prefetch: Number(process.env.RABBITMQ_PREFETCH || 10),
  maxRetries: Number(process.env.RABBITMQ_MAX_RETRIES || 3),
  topologies: [
    { exchange: 'srmm.arriendos', queue: 'srmm.notificaciones.arriendo-creado', routingKey: 'arriendo.creado', deadLetterExchange: 'srmm.arriendos.dlx', deadLetterQueue: 'srmm.notificaciones.arriendo-creado.dlq', deadLetterRoutingKey: 'arriendo.creado.dead' },
    { exchange: 'srmm.logistica', queue: 'srmm.notificaciones.logistica-estado', routingKey: 'logistica.estado-cambiado', deadLetterExchange: 'srmm.logistica.dlx', deadLetterQueue: 'srmm.notificaciones.logistica-estado.dlq', deadLetterRoutingKey: 'logistica.estado-cambiado.dead' },
    { exchange: 'srmm.mantenimientos', queue: 'srmm.tickets.incidencia-critica', routingKey: 'mantenimiento.incidencia-critica', deadLetterExchange: 'srmm.mantenimientos.dlx', deadLetterQueue: 'srmm.tickets.incidencia-critica.dlq', deadLetterRoutingKey: 'mantenimiento.incidencia-critica.dead' }
  ]
};

function retryCount(message) {
  const value = message.properties.headers?.['x-retry-count'];
  return Number.isInteger(value) ? value : Number(value || 0);
}

export function nextRetryHeaders(message) {
  return { ...message.properties.headers, 'x-retry-count': retryCount(message) + 1 };
}

export function shouldRetry(message) {
  return retryCount(message) < config.maxRetries;
}

async function declareTopology(channel, topology) {
  await channel.assertExchange(topology.exchange, 'topic', { durable: true });
  await channel.assertExchange(topology.deadLetterExchange, 'topic', { durable: true });
  await channel.assertQueue(topology.deadLetterQueue, { durable: true });
  await channel.bindQueue(topology.deadLetterQueue, topology.deadLetterExchange, topology.deadLetterRoutingKey);
  await channel.assertQueue(topology.queue, {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': topology.deadLetterExchange,
      'x-dead-letter-routing-key': topology.deadLetterRoutingKey
    }
  });
  await channel.bindQueue(topology.queue, topology.exchange, topology.routingKey);
}

async function handleNotification(message) {
  const event = JSON.parse(message.content.toString());
  if (event.eventType === 'arriendo.creado') {
    if (!event.data?.id_contrato) throw new Error('El evento no contiene id_contrato.');
    console.info('Notificacion de arriendo creada procesada.', { eventId: event.eventId, idContrato: event.data.id_contrato });
    return;
  }
  if (event.eventType === 'logistica.estado-cambiado') {
    if (!event.data?.id_evento) throw new Error('El evento logistico no contiene id_evento.');
    console.info('Notificacion de estado logistico procesada.', { eventId: event.eventId, idEvento: event.data.id_evento });
    return;
  }
  if (event.eventType === 'mantenimiento.incidencia-critica') {
    if (!event.data?.id_incidencia) throw new Error('La incidencia no contiene id_incidencia.');
    console.info('Incidencia critica procesada.', { eventId: event.eventId, idIncidencia: event.data.id_incidencia });
    return;
  }
  throw new Error(`Tipo de evento no soportado: ${event.eventType || 'desconocido'}.`);
}

export async function startConsumer() {
  const connection = await amqp.connect(config.url);
  const channel = await connection.createChannel();
  for (const topology of config.topologies) await declareTopology(channel, topology);
  await channel.prefetch(config.prefetch);
  for (const topology of config.topologies) channel.consume(topology.queue, async (message) => {
    if (!message) return;
    try {
      await handleNotification(message);
      channel.ack(message);
    } catch (error) {
      if (shouldRetry(message)) {
        channel.publish(topology.exchange, topology.routingKey, message.content, {
          ...message.properties,
          persistent: true,
          headers: nextRetryHeaders(message)
        });
        channel.ack(message);
        console.warn('Mensaje de notificacion reencolado para reintento.', {
          messageId: message.properties.messageId || null,
          retryCount: retryCount(message) + 1,
          reason: error.message
        });
      } else {
        console.error('Mensaje enviado a DLQ.', {
          messageId: message.properties.messageId || null,
          queue: topology.queue,
          reason: error.message
        });
        channel.nack(message, false, false);
      }
    }
  });
  console.info(`Consumidor de notificaciones activo en ${config.topologies.map((topology) => topology.queue).join(', ')}.`);
}

if (process.argv[1] && process.argv[1].endsWith('consumer.js')) {
  startConsumer().catch((error) => {
    console.error('No se pudo iniciar el consumidor de notificaciones.', {
      name: error.name,
      code: error.code || null,
      message: error.message || String(error)
    });
    process.exitCode = 1;
  });
}
