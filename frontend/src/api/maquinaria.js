import client, { getAccessToken } from './client';

async function authConfig() {
  const token = await getAccessToken();
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
}

export async function listMaquinaria() {
  const response = await client.get('/maquinaria', await authConfig());
  return Array.isArray(response.data) ? response.data : [];
}

export async function createMaquinaria(payload) {
  const response = await client.post('/maquinaria', payload, await authConfig());
  return response.data;
}

export async function updateMaquinaria(id, payload) {
  const response = await client.put(`/maquinaria/${id}`, payload, await authConfig());
  return response.data;
}
