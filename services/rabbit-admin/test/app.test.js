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
    deleteQueue: async () => ({ messageCount: 0 }),
    assertExchange: async (input) => ({ exchange: input.exchange }),
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
  assert.equal(response.status, 200);
  assert.equal(response.body.data.queue, 'events');
});

test('rabbit-admin responde 400 con payload inválido', async () => {
  const response = await request(createApp(serviceStub(), authFor({ roles: ['Administrador'] })))
    .post('/exchanges').set('Authorization', 'Bearer token').send({ exchange: 'bad name' });
  assert.equal(response.status, 400);
});
