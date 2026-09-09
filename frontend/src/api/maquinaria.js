import client from './client';

export async function listMaquinaria() {
  const response = await client.get('/maquinaria');
  return Array.isArray(response.data) ? response.data : [];
}

export async function createMaquinaria(payload) {
  const response = await client.post('/maquinaria', payload);
  return response.data;
}

export async function updateMaquinaria(id, payload) {
  const response = await client.put(`/maquinaria/${id}`, payload);
  return response.data;
}
