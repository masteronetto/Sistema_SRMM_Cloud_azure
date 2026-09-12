import { useIsAuthenticated } from '@azure/msal-react';

export default function AzureGate({ children }) {
  const isAuthenticated = useIsAuthenticated();

  if (!isAuthenticated) {
    return (
      <section className="access-placeholder">
        <h1>Inicia sesión para abrir este módulo.</h1>
      </section>
    );
  }

  return children;
}
