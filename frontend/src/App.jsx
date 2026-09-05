import { useState } from 'react';
import { useIsAuthenticated } from '@azure/msal-react';
import AzureSession from './components/AzureSession';
import { getCurrentUser } from './api/client';

const domains = [
  { title: 'Maquinaria', description: 'Inventario, estados y horómetros.', status: 'Siguiente módulo' },
  { title: 'Mantenimiento', description: 'Órdenes de trabajo e historial técnico.', status: 'Siguiente módulo' },
  { title: 'Reportes', description: 'Indicadores operativos y actividad.', status: 'Siguiente módulo' }
];

function AuthenticatedActions() {
  const isAuthenticated = useIsAuthenticated();
  const [status, setStatus] = useState('');

  async function checkBff() {
    setStatus('Consultando identidad...');
    try {
      const user = await getCurrentUser();
      setStatus(`Identidad validada: ${user.name || user.subject}`);
    } catch (error) {
      setStatus(error.response?.data?.message || 'El BFF aún no acepta esta identidad.');
    }
  }

  if (!isAuthenticated) return null;

  return (
    <div className="identity-check">
      <button className="button button-secondary" type="button" onClick={checkBff}>
        Probar conexión segura
      </button>
      {status && <span>{status}</span>}
    </div>
  );
}

export default function App({ azureConfigured }) {
  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="SRMM inicio">
          <span className="brand-mark">S</span>
          <span>SRMM <small>cloud base</small></span>
        </a>
        {azureConfigured && <AzureSession />}
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">Sistema de gestión operacional</p>
          <h1>Una base limpia para construir el nuevo SRMM.</h1>
          <p className="hero-copy">
            Frontend React preparado para Microsoft Entra ID y un BFF separado. La identidad y la persistencia se conectarán cuando el tenant esté listo.
          </p>
          {azureConfigured ? (
            <AuthenticatedActions />
          ) : (
            <div className="setup-note">
              <strong>Tenant pendiente</strong>
              <span>Configura las variables VITE_AZURE_* para habilitar el inicio de sesión.</span>
            </div>
          )}
        </div>
        <aside className="architecture-panel">
          <span className="panel-label">Estado de la base</span>
          <strong>React + MSAL + BFF</strong>
          <div className="status-line"><i /> API desacoplada</div>
          <div className="status-line"><i /> Tokens fuera del código</div>
          <div className="status-line"><i /> Persistencia pendiente</div>
        </aside>
      </section>

      <section className="domain-grid" aria-label="Módulos preparados">
        {domains.map((domain) => (
          <article className="domain-card" key={domain.title}>
            <span className="card-index">0{domains.indexOf(domain) + 1}</span>
            <h2>{domain.title}</h2>
            <p>{domain.description}</p>
            <span className="card-status">{domain.status}</span>
          </article>
        ))}
      </section>
    </main>
  );
}
