import amqp from 'amqplib';

const config = {
  url: process.env.RABBITMQ_URL || 'amqp://srmm:local_dev_only@localhost:5672',
  prefetch: Number(process.env.RABBITMQ_PREFETCH || 10),
  maxRetries: Number(process.env.RABBITMQ_MAX_RETRIES || 3),
  exchange: 'srmm.arriendos',
  queue: 'srmm.notificaciones.arriendo-creado',
  routingKey: 'arriendo.creado',
  deadLetterExchange: 'srmm.arriendos.dlx',
  deadLetterQueue: 'srmm.notificaciones.arriendo-creado.dlq',
  deadLetterRoutingKey: 'arriendo.creado.dead'
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

async function declareTopology(channel) {
  await channel.assertExchange(config.exchange, 'topic', { durable: true });
  await channel.assertExchange(config.deadLetterExchange, 'topic', { durable: true });
  await channel.assertQueue(config.deadLetterQueue, { durable: true });
  await channel.bindQueue(config.deadLetterQueue, config.deadLetterExchange, config.deadLetterRoutingKey);
  await channel.assertQueue(config.queue, {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': config.deadLetterExchange,
      'x-dead-letter-routing-key': config.deadLetterRoutingKey
    }
  });
  await channel.bindQueue(config.queue, config.exchange, config.routingKey);
}

async function handleNotification(message) {
  const event = JSON.parse(message.content.toString());
  if (!event.data?.id_contrato) throw new Error('El evento no contiene id_contrato.');
  console.info('Notificacion de arriendo creada procesada.', {
    eventId: event.eventId,
    idContrato: event.data.id_contrato,
    clienteId: event.data.cliente_id
  });
}

export async function startConsumer() {
  const connection = await amqp.connect(config.url);
  const channel = await connection.createChannel();
  await declareTopology(channel);
  await channel.prefetch(config.prefetch);
  channel.consume(config.queue, async (message) => {
    if (!message) return;
    try {
      await handleNotification(message);
      channel.ack(message);
    } catch (error) {
      if (shouldRetry(message)) {
        channel.publish(config.exchange, config.routingKey, message.content, {
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
          queue: config.queue,
          reason: error.message
        });
        channel.nack(message, false, false);
      }
    }
  });
  console.info(`Consumidor de notificaciones activo en ${config.queue}.`);
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
