import { randomUUID } from 'node:crypto';
import amqp from 'amqplib';
import { rabbitConfig, rentalCreatedTopology, logisticsStateTopology, criticalIncidentTopology } from './rabbit.config.js';

let connectionPromise;
let channelPromise;

async function getConfirmChannel() {
  if (!connectionPromise) {
    connectionPromise = amqp.connect(rabbitConfig.url).catch((error) => {
      connectionPromise = undefined;
      throw error;
    });
  }
  const connection = await connectionPromise;
  if (!channelPromise) {
    channelPromise = connection.createConfirmChannel().catch((error) => {
      channelPromise = undefined;
      throw error;
    });
  }
  return channelPromise;
}

export async function declareRentalCreatedTopology(channel) {
  const topology = rentalCreatedTopology();
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

export async function publishRentalCreated(arriendo) {
  return publishEvent(rentalCreatedTopology(), 'arriendo.creado', arriendo);
}

async function publishEvent(topology, eventType, data) {
  if (!rabbitConfig.enabled) return false;

  try {
    const channel = await getConfirmChannel();
    await declareTopology(channel, topology);
    const message = Buffer.from(JSON.stringify({
      eventId: randomUUID(),
      eventType,
      occurredAt: new Date().toISOString(),
      data
    }));
    channel.publish(topology.exchange, topology.routingKey, message, {
      contentType: 'application/json',
      deliveryMode: 2,
      persistent: true
    });
    await channel.waitForConfirms();
    return true;
  } catch (error) {
    console.error('RabbitMQ no disponible; se conserva la respuesta del BFF.', {
      eventType,
      message: error.message
    });
    connectionPromise = undefined;
    channelPromise = undefined;
    return false;
  }
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

export async function publishLogisticsStateChanged(event) {
  return publishEvent(logisticsStateTopology(), 'logistica.estado-cambiado', event);
}

export async function publishCriticalMaintenanceIncident(event) {
  return publishEvent(criticalIncidentTopology(), 'mantenimiento.incidencia-critica', event);
}

export function resetRabbitPublisher() {
  connectionPromise = undefined;
  channelPromise = undefined;
}
