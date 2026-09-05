import { useEffect } from 'react';
import { useIsAuthenticated, useMsal } from '@azure/msal-react';
import { loginRequest } from '../auth/msalConfig';

export default function AzureSession() {
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();

  useEffect(() => {
    if (accounts[0] && !instance.getActiveAccount()) {
      instance.setActiveAccount(accounts[0]);
    }
  }, [accounts, instance]);

  if (!isAuthenticated) {
    return (
      <button className="button button-primary" type="button" onClick={() => instance.loginRedirect(loginRequest)}>
        Iniciar sesión con Microsoft
      </button>
    );
  }

  return (
    <div className="session-controls">
      <span className="session-user">{accounts[0]?.name || accounts[0]?.username}</span>
      <button className="button button-quiet" type="button" onClick={() => instance.logoutRedirect()}>
        Cerrar sesión
      </button>
    </div>
  );
}
