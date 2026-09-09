import test from 'node:test';
import assert from 'node:assert/strict';
import { requireAnyRole, requireAzureToken } from '../src/middleware/azureAuth.js';

function responseDouble() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

test('rechaza una petición sin bearer token', async () => {
  const response = responseDouble();
  await requireAzureToken({ get: () => '' }, response, () => {
    throw new Error('No debe continuar sin token');
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.body.message, 'Bearer token requerido.');
});

test('rechaza un usuario que no tiene el App Role requerido', () => {
  const response = responseDouble();
  const request = { auth: { roles: ['Usuario'] } };

  requireAnyRole('Administrador')(request, response, () => {
    throw new Error('No debe continuar sin Administrador');
  });

  assert.equal(response.statusCode, 403);
  assert.deepEqual(response.body.requiredRoles, ['Administrador']);
});

test('permite un usuario con el App Role requerido', () => {
  const response = responseDouble();
  let continued = false;

  requireAnyRole('Administrador')({ auth: { roles: ['Administrador'] } }, response, () => {
    continued = true;
  });

  assert.equal(continued, true);
  assert.equal(response.statusCode, null);
});
