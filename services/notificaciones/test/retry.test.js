import test from 'node:test';
import assert from 'node:assert/strict';
import { nextRetryHeaders, shouldRetry } from '../src/consumer.js';

test('incrementa el contador de reintentos', () => {
  const message = { properties: { headers: { 'x-retry-count': 1 } } };
  assert.equal(nextRetryHeaders(message)['x-retry-count'], 2);
});

test('permite reintento mientras no se alcanza el maximo', () => {
  assert.equal(shouldRetry({ properties: { headers: { 'x-retry-count': 2 } } }), true);
  assert.equal(shouldRetry({ properties: { headers: { 'x-retry-count': 3 } } }), false);
});
