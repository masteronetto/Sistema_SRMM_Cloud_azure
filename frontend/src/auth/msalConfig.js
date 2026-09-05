import { PublicClientApplication } from '@azure/msal-browser';

const clientId = import.meta.env.VITE_AZURE_CLIENT_ID || '';
const tenantId = import.meta.env.VITE_AZURE_TENANT_ID || '';
const redirectUri = import.meta.env.VITE_AZURE_REDIRECT_URI || window.location.origin;
const apiScope = import.meta.env.VITE_AZURE_API_SCOPE || '';

export const isAzureConfigured = Boolean(clientId && tenantId && apiScope);

export const loginRequest = {
  scopes: apiScope ? [apiScope] : []
};

export const msalInstance = isAzureConfigured
  ? new PublicClientApplication({
      auth: {
        clientId,
        authority: `https://login.microsoftonline.com/${tenantId}`,
        redirectUri,
        postLogoutRedirectUri: redirectUri
      },
      cache: {
        cacheLocation: 'sessionStorage'
      }
    })
  : null;
