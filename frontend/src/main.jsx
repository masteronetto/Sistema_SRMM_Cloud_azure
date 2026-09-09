import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MsalProvider } from '@azure/msal-react';
import App from './App';
import { isAzureConfigured, msalInstance } from './auth/msalConfig';
import './styles.css';

const root = createRoot(document.getElementById('root'));

function renderApp() {
  const app = <App azureConfigured={isAzureConfigured} />;
  root.render(<StrictMode>{isAzureConfigured ? <MsalProvider instance={msalInstance}>{app}</MsalProvider> : app}</StrictMode>);
}

if (msalInstance) {
  msalInstance.initialize().then(() => msalInstance.handleRedirectPromise()).then((result) => {
    const account = result?.account || msalInstance.getAllAccounts()[0];
    if (account) msalInstance.setActiveAccount(account);
    renderApp();
  }).catch((error) => {
    console.error('No se pudo inicializar MSAL:', error);
    renderApp();
  });
} else {
  renderApp();
}
