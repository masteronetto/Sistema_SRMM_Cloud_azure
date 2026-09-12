import client from './client';

export async function listArriendos() {
  const response = await client.get('/arriendos');
  return Array.isArray(response.data) ? response.data : [];
}

export async function listMisContratos() {
  const response = await client.get('/arriendos/mis-contratos');
  return Array.isArray(response.data) ? response.data : [];
}

export async function createArriendo(payload) {
  const response = await client.post('/arriendos', payload);
  return response.data;
}

export async function deleteArriendo(id) {
  const response = await client.delete(`/arriendos/${id}`);
  return response.data;
}
