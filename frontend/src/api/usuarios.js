import client from './client';

export async function listUsuarios() {
  const response = await client.get('/usuarios');
  return Array.isArray(response.data) ? response.data : [];
}

export async function createUsuario(payload) {
  const response = await client.post('/usuarios', payload);
  return response.data;
}

export async function updateUsuario(oid, payload) {
  const response = await client.put(`/usuarios/${encodeURIComponent(oid)}`, payload);
  return response.data;
}

export async function deleteUsuario(oid) {
  const response = await client.delete(`/usuarios/${encodeURIComponent(oid)}`);
  return response.data;
}
