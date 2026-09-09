import axios from 'axios';
import { InteractionRequiredAuthError } from '@azure/msal-browser';
import { loginRequest, msalInstance } from '../auth/msalConfig';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: { 'Content-Type': 'application/json' }
});

export async function getAccessToken({ allowInteraction = true } = {}) {
  if (!msalInstance) return null;

  const account = msalInstance.getActiveAccount() || msalInstance.getAllAccounts()[0];
  if (!account) return null;

  try {
    const response = await msalInstance.acquireTokenSilent({ ...loginRequest, account });
    return response.accessToken;
  } catch (error) {
    if (!allowInteraction || !(error instanceof InteractionRequiredAuthError)) {
      throw error;
    }

    const response = await msalInstance.acquireTokenPopup(loginRequest);
    if (response.account) msalInstance.setActiveAccount(response.account);
    return response.accessToken;
  }
}

export async function getCurrentUser() {
  const response = await client.get('/me');
  return response.data;
}

client.interceptors.request.use(async (config) => {
  if (!msalInstance || config.skipAuth) return config;
  const token = await getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 403) {
      error.userMessage = 'Tu cuenta está autenticada, pero no tiene permisos para esta operación.';
    }

    if (error.response?.status === 401 && msalInstance) {
      error.userMessage = 'La sesión de Microsoft expiró o dejó de ser válida.';
      await msalInstance.logoutRedirect({
        account: msalInstance.getActiveAccount() || undefined,
        postLogoutRedirectUri: window.location.origin
      });
    }

    return Promise.reject(error);
  }
);

export default client;
