import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBindingBody, validateExchangeBody, validateName } from '../src/validation.js';

test('rechaza nombres RabbitMQ invalidos', () => {
  assert.throws(() => validateName('bad name', 'queue'), { statusCode: 400 });
});

test('rechaza tipos de exchange no soportados', () => {
  assert.throws(() => validateExchangeBody({ exchange: 'events', type: 'invalid' }), { statusCode: 400 });
});

test('valida bindings completos', () => {
  assert.deepEqual(validateBindingBody({
    exchange: 'events',
    queue: 'events.queue',
    routingKey: 'events.created'
  }), {
    exchange: 'events',
    queue: 'events.queue',
    routingKey: 'events.created'
  });
});
