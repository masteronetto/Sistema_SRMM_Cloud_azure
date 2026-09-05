import client, { getAccessToken } from './client';

async function authConfig() {
  const token = await getAccessToken();
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
}

export async function getReportData(path, params = {}) {
  const response = await client.get(path, { ...(await authConfig()), params });
  return response.data;
}

export async function downloadReport(path, params = {}) {
  const response = await client.get(path, {
    ...(await authConfig()),
    params,
    responseType: 'blob'
  });
  return response;
}
