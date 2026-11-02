import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { RabbitAdminService } from '../src/rabbit-admin.service.js';

const rabbitUrl = process.env.RABBITMQ_TEST_URL;
const managementUrl = process.env.RABBITMQ_TEST_MANAGEMENT_URL;

function adminAuth(_req, _res, next) {
  return next();
}

test('rabbit-admin recovers its AMQP channel after a missing-queue 404', {
  skip: !rabbitUrl || !managementUrl
}, async (t) => {
  const service = new RabbitAdminService(rabbitUrl, managementUrl);
  const app = createApp(service, adminAuth);
  const existingQueue = `srmm.rabbit-admin.recovery.${randomUUID()}`;
  const missingQueue = `srmm.rabbit-admin.missing.${randomUUID()}`;

  t.after(async () => service.close());
  await service.assertQueue({ queue: existingQueue, durable: false });

  const missing = await request(app).get(`/queues/${missingQueue}`);
  assert.equal(missing.status, 404);
  assert.equal(missing.body.message, 'La cola no existe.');

  const existing = await request(app).get(`/queues/${existingQueue}`);
  assert.equal(existing.status, 200);
  assert.equal(existing.body.data.queue, existingQueue);

  const queues = await request(app).get('/queues');
  assert.equal(queues.status, 200);
  assert.ok(queues.body.data.some((queue) => queue.name === existingQueue));

  await service.deleteQueue(existingQueue);
});
