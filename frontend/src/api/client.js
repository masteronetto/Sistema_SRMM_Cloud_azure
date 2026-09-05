import axios from 'axios';
import { loginRequest, msalInstance } from '../auth/msalConfig';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: { 'Content-Type': 'application/json' }
});

export async function getAccessToken() {
  if (!msalInstance) return null;

  const account = msalInstance.getActiveAccount() || msalInstance.getAllAccounts()[0];
  if (!account) return null;

  const response = await msalInstance.acquireTokenSilent({
    ...loginRequest,
    account
  });

  return response.accessToken;
}

export async function getCurrentUser() {
  const token = await getAccessToken();
  const response = await client.get('/me', {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined
  });
  return response.data;
}

export default client;
