import { useIsAuthenticated } from '@azure/msal-react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser } from '../api/client';
import { useState } from 'react';

const domains = [
  { path: '/maquinaria', title: 'Maquinaria', description: 'Inventario, estados y horómetros.', status: 'Módulo migrado' },
  { path: '/historial', title: 'Historial', description: 'Mantenciones y registros técnicos.', status: 'Módulo migrado' },
  { path: '/reportes', title: 'Reportes', description: 'Indicadores operativos y actividad.', status: 'Módulo migrado' }
];

export default function HomePage({ azureConfigured }) {
  const navigate = useNavigate();
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

  return (
    <>
      <section className="hero">
        <div>
          <p className="eyebrow">Sistema de gestión operacional</p>
          <h1>Una base limpia para construir el nuevo SRMM.</h1>
          <p className="hero-copy">Frontend React preparado para Microsoft Entra ID y un BFF separado. La identidad y la persistencia se conectarán cuando el tenant esté listo.</p>
          {azureConfigured ? (
            <AuthenticatedHomeActions checkBff={checkBff} status={status} />
          ) : (
            <div className="setup-note"><strong>{azureConfigured ? 'Sesión pendiente' : 'Tenant pendiente'}</strong><span>{azureConfigured ? 'Inicia sesión para probar los módulos.' : 'Configura las variables VITE_AZURE_* para habilitar el inicio de sesión.'}</span></div>
          )}
        </div>
        <aside className="architecture-panel"><span className="panel-label">Estado de la base</span><strong>React + MSAL + BFF</strong><div className="status-line"><i /> API desacoplada</div><div className="status-line"><i /> Tokens fuera del código</div><div className="status-line"><i /> Persistencia pendiente</div></aside>
      </section>
      <section className="domain-grid" aria-label="Módulos preparados">
        {domains.map((domain, index) => <article className="domain-card" key={domain.title}><span className="card-index">0{index + 1}</span><h2>{domain.title}</h2><p>{domain.description}</p><button className="card-status card-link" type="button" onClick={() => navigate(domain.path)}>{domain.status}</button></article>)}
      </section>
    </>
  );
}

function AuthenticatedHomeActions({ checkBff, status }) {
  const isAuthenticated = useIsAuthenticated();
  if (!isAuthenticated) return <div className="setup-note"><strong>Sesión pendiente</strong><span>Inicia sesión para probar los módulos.</span></div>;
  return <div className="identity-check"><button className="button button-secondary" type="button" onClick={checkBff}>Probar conexión segura</button>{status && <span>{status}</span>}</div>;
}
