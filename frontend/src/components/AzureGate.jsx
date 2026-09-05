import { useIsAuthenticated } from '@azure/msal-react';

export default function AzureGate({ children }) {
  const isAuthenticated = useIsAuthenticated();

  if (!isAuthenticated) {
    return (
      <section className="access-placeholder">
        <p className="eyebrow">Acceso protegido</p>
        <h1>Inicia sesión para abrir este módulo.</h1>
        <p>La sesión real se habilitará cuando se configure el tenant de Microsoft Entra ID.</p>
      </section>
    );
  }

  return children;
}
