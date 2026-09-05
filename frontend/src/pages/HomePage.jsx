import { useIsAuthenticated } from '@azure/msal-react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser } from '../api/client';
import { useState } from 'react';

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

  const demoAlerts = [
    ['⌛', 'Prueba — Mantenimiento retrasado', '1 día(s) de retraso · Mecánico: rou · Programada: 09-06-2026'],
    ['⌛', 'Prueba 2 — Mantenimiento retrasado', '2 día(s) de retraso · Mecánico: rou · Programada: 08-06-2026'],
    ['△', 'Prueba 4 — Mantenimiento urgente', 'Umbral superado en 50.01 hrs'],
    ['△', 'Prueba 2 — Mantenimiento urgente', 'Umbral superado en 50 hrs'],
    ['△', 'Prueba 3 — Mantenimiento urgente', 'Umbral superado en 1 hrs']
  ];

  return (
    <div className="dashboard-home">
      <section className="welcome-panel"><div><h2>Bienvenido al Sistema SRMM</h2><p>Sesión activa como: <strong>Admin Inicial</strong> · admin@srmm.cl</p></div>{azureConfigured ? <AuthenticatedHomeActions checkBff={checkBff} status={status} /> : <span className="demo-label">Vista previa local</span>}</section>
      <section className="metric-grid dashboard-metrics">
        <MetricCard label="Total maquinaria" value="8" detail="5 categorías de estado" tone="blue" />
        <MetricCard label="Disponibles" value="1" detail="Listas para uso" tone="green" />
        <MetricCard label="En arriendo" value="2" detail="Activos hoy" tone="orange" />
        <MetricCard label="Mantenimiento urgente" value="3" detail="Acción requerida" tone="red" />
      </section>
      <section className="dashboard-grid">
        <article className="dashboard-card alerts-card"><h2>Alertas críticas</h2><div className="alert-list">{demoAlerts.map(([icon, title, detail]) => <div className="critical-alert" key={title}><span className="critical-icon">{icon}</span><div><strong>{title}</strong><span>{detail}</span></div></div>)}</div></article>
        <article className="dashboard-card park-card"><h2>Estado del parque</h2><ParkRow label="Disponibles" value="1" percent="13%" width="13%" /><ParkRow label="En arriendo" value="2" percent="25%" width="25%" /><ParkRow label="Mantenimiento" value="2" percent="25%" width="25%" /><div className="demo-chart"><div className="chart-y-axis"><span>45.000</span><span>30.000</span><span>15.000</span><span>0</span></div><div className="chart-bars"><i style={{ height: '82%' }} /><i style={{ height: '7%' }} /><i style={{ height: '3%' }} /><i style={{ height: '5%' }} /><i style={{ height: '2%' }} /></div></div><div className="chart-labels"><span>Prueba</span><span>CAT 320D</span><span>Retroexcavadora JCB 3CX</span><span>Prueba 4</span><span>Prueba 2</span></div></article>
      </section>
      {!azureConfigured && <div className="preview-note">Los indicadores mostrados son datos de demostración para revisar el diseño. La conexión real se activará al configurar Microsoft Entra ID y el BFF.</div>}
    </div>
  );
}

function MetricCard({ label, value, detail, tone }) {
  return <article className="metric-card"><span>{label}</span><strong className={`metric-${tone}`}>{value}</strong><small>{detail}</small></article>;
}

function ParkRow({ label, value, percent, width }) {
  return <div className="park-row"><span>{label}</span><div><i style={{ width }} /></div><strong>{value} <small>({percent})</small></strong></div>;
}

function AuthenticatedHomeActions({ checkBff, status }) {
  const isAuthenticated = useIsAuthenticated();
  if (!isAuthenticated) return <div className="setup-note"><strong>Sesión pendiente</strong><span>Inicia sesión para probar los módulos.</span></div>;
  return <div className="identity-check"><button className="button button-secondary" type="button" onClick={checkBff}>Probar conexión segura</button>{status && <span>{status}</span>}</div>;
}
