import client from './client';

export async function getServiceTypes() {
  const response = await client.get('/mantenimientos/tipos-servicio');
  return Array.isArray(response.data?.data) ? response.data.data : [];
}

export async function getMaintenanceHistory(machineId, params) {
  const response = await client.get(`/mantenimientos/maquina/${machineId}/historial`, { params });
  return response.data;
}

export async function downloadMaintenanceHistory(machineId, params) {
  return client.get(`/mantenimientos/maquina/${machineId}/historial`, { params, responseType: 'blob' });
}
