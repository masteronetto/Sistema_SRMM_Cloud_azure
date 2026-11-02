import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';

function authFor(payload) {
  return (req, res, next) => {
    const authorization = req.get('authorization') || '';
    if (!authorization) return res.status(401).json({ message: 'Bearer requerido.' });
    if (payload === null) return res.status(401).json({ message: 'Token Azure AD invalido o expirado.' });
    if (!payload.roles?.includes('Administrador')) {
      return res.status(403).json({ message: 'Se requiere el rol Administrador.' });
    }
    req.auth = payload;
    return next();
  };
}

function serviceStub() {
  return {
    assertQueue: async (input) => ({ queue: input.queue, messageCount: 0, consumerCount: 0 }),
    getQueue: async (queue) => ({ queue, messageCount: 0, consumerCount: 0 }),
    listQueues: async () => [{ name: 'events' }],
    deleteQueue: async () => ({ messageCount: 0 }),
    assertExchange: async (input) => ({ exchange: input.exchange }),
    listExchanges: async () => [{ name: 'events' }],
    deleteExchange: async () => ({}),
    bindQueue: async () => ({}),
    unbindQueue: async () => ({})
  };
}

test('rabbit-admin responde 401 sin token', async () => {
  const response = await request(createApp(serviceStub(), authFor(null))).post('/queues').send({ queue: 'events' });
  assert.equal(response.status, 401);
});

test('rabbit-admin responde 403 sin rol Administrador', async () => {
  const response = await request(createApp(serviceStub(), authFor({ roles: ['Operador'] })))
    .post('/queues').set('Authorization', 'Bearer token').send({ queue: 'events' });
  assert.equal(response.status, 403);
});

test('rabbit-admin ejecuta una operación con rol Administrador', async () => {
  const response = await request(createApp(serviceStub(), authFor({ roles: ['Administrador'] })))
    .post('/queues').set('Authorization', 'Bearer token').send({ queue: 'events' });
  assert.equal(response.status, 201);
  assert.equal(response.body.data.queue, 'events');
});

test('rabbit-admin responde 400 con payload inválido', async () => {
  const response = await request(createApp(serviceStub(), authFor({ roles: ['Administrador'] })))
    .post('/exchanges').set('Authorization', 'Bearer token').send({ exchange: 'bad name' });
  assert.equal(response.status, 400);
});

test('rabbit-admin lista colas y exchanges', async () => {
  const app = createApp(serviceStub(), authFor({ roles: ['Administrador'] }));
  const queues = await request(app).get('/queues').set('Authorization', 'Bearer test');
  const exchanges = await request(app).get('/exchanges').set('Authorization', 'Bearer test');
  assert.equal(queues.status, 200);
  assert.equal(queues.body.data[0].name, 'events');
  assert.equal(exchanges.status, 200);
  assert.equal(exchanges.body.data[0].name, 'events');
});

test('rabbit-admin responde 404 cuando la cola no existe', async () => {
  const service = serviceStub();
  service.getQueue = async () => {
    const error = new Error('La cola no existe.');
    error.statusCode = 404;
    throw error;
  };
  const response = await request(createApp(service, authFor({ roles: ['Administrador'] })))
    .get('/queues/missing').set('Authorization', 'Bearer test');
  assert.equal(response.status, 404);
});
