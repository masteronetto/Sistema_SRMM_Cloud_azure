import client from './client';

export async function listLogistica({ maquinariaIds = [] } = {}) {
  const params = maquinariaIds.length ? { maquinaria_ids: maquinariaIds.join(',') } : {};
  const response = await client.get('/logistica', { params });
  return response.data;
}

export async function createLogistica(payload) {
  const response = await client.post('/logistica', payload);
  return response.data;
}

export async function updateLogistica(idEvento, payload) {
  const response = await client.put(`/logistica/${idEvento}`, payload);
  return response.data;
}

export async function deleteLogistica(idEvento) {
  const response = await client.delete(`/logistica/${idEvento}`);
  return response.data;
}
