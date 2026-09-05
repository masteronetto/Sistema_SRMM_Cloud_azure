import client, { getAccessToken } from './client';

async function authConfig(extra = {}) {
  const token = await getAccessToken();
  return {
    ...extra,
    headers: {
      ...(extra.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  };
}

export async function getServiceTypes() {
  const response = await client.get('/mantenimientos/tipos-servicio', await authConfig());
  return Array.isArray(response.data?.data) ? response.data.data : [];
}

export async function getMaintenanceHistory(machineId, params) {
  const response = await client.get(`/mantenimientos/maquina/${machineId}/historial`, await authConfig({ params }));
  return response.data;
}

export async function downloadMaintenanceHistory(machineId, params) {
  return client.get(`/mantenimientos/maquina/${machineId}/historial`, await authConfig({ params, responseType: 'blob' }));
}
