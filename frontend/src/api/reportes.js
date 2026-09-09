import client from './client';

export async function getReportData(path, params = {}) {
  const response = await client.get(path, { params });
  return response.data;
}

export async function downloadReport(path, params = {}) {
  const response = await client.get(path, { params, responseType: 'blob' });
  return response;
}
