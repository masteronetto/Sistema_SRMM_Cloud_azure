import { useIsAuthenticated } from '@azure/msal-react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser } from '../api/client';
import { useEffect, useState } from 'react';
import { useMsal } from '@azure/msal-react';
import { useIdentity } from '../auth/IdentityContext';
import { getReportData } from '../api/reportes';

export default function HomePage({ azureConfigured }) {
  const navigate = useNavigate();
  const { profile, loading } = useIdentity();
  const [status, setStatus] = useState('');
  const [dashboardData, setDashboardData] = useState({ stats: [], machines: [], loaded: false });

  useEffect(() => {
    if (!azureConfigured || loading || !profile?.roles?.length) return undefined;
    let active = true;
    Promise.allSettled([
      getReportData('/reportes/estadisticas'),
      getReportData('/reportes/top-maquinas')
    ]).then(([statsResult, machinesResult]) => {
      if (!active) return;
      setDashboardData({
        stats: statsResult.status === 'fulfilled' && Array.isArray(statsResult.value) ? statsResult.value : [],
        machines: machinesResult.status === 'fulfilled' && Array.isArray(machinesResult.value) ? machinesResult.value : [],
        loaded: true
      });
    });
    return () => { active = false; };
  }, [azureConfigured, loading, profile]);

  if (azureConfigured && !loading && profile && !profile.roles?.length) {
    return <section className="access-placeholder"><p className="eyebrow">Acceso pendiente</p><h1>No tienes un rol asignado.</h1><p>Tu cuenta está autenticada, pero no puede acceder al dashboard hasta que un administrador le asigne un App Role.</p></section>;
  }

  async function checkBff() {
    setStatus('Consultando identidad...');
    try {
      const user = await getCurrentUser();
      setStatus(`Identidad validada: ${user.name || user.subject}`);
    } catch (error) {
      const payload = error.response?.data;
      const diagnostic = payload?.diagnosticMessage || payload?.diagnostic;
      setStatus(diagnostic ? `${payload.message} (${payload.diagnostic}: ${diagnostic})` : error.userMessage || payload?.message || 'El BFF aún no acepta esta identidad.');
    }
  }

  const totalMachines = dashboardData.machines.length || dashboardData.stats.length;
  const availableMachines = dashboardData.machines.filter((machine) => machine.estado === 'Disponible').length;
  const rentedMachines = dashboardData.machines.filter((machine) => machine.estado === 'Arrendada').length;
  const maintenanceMachines = dashboardData.machines.filter((machine) => ['Mantencion', 'Mantenimiento'].includes(machine.estado)).length;
  const hasData = dashboardData.loaded && totalMachines > 0;

  return (
    <div className="dashboard-home">
      <section className="welcome-panel"><WelcomeIdentity azureConfigured={azureConfigured} />{azureConfigured ? <AuthenticatedHomeActions checkBff={checkBff} status={status} /> : <span className="demo-label">Vista previa local</span>}</section>
      <section className="metric-grid dashboard-metrics">
        <MetricCard label="Total maquinaria" value={hasData ? totalMachines : '—'} detail={hasData ? 'Datos del BFF' : 'Sin datos disponibles'} tone="blue" />
        <MetricCard label="Disponibles" value={hasData ? availableMachines : '—'} detail={hasData ? 'Listas para uso' : 'Sin datos disponibles'} tone="green" />
        <MetricCard label="En arriendo" value={hasData ? rentedMachines : '—'} detail={hasData ? 'Activos hoy' : 'Sin datos disponibles'} tone="orange" />
        <MetricCard label="Mantenimiento urgente" value={hasData ? maintenanceMachines : '—'} detail={hasData ? 'Requieren revisión' : 'Sin datos disponibles'} tone="red" />
      </section>
      <section className="dashboard-grid">
        <article className="dashboard-card alerts-card"><h2>Alertas críticas</h2><div className="empty-dashboard-state">No hay alertas disponibles.</div></article>
        <article className="dashboard-card park-card"><h2>Estado del parque</h2><ParkRow label="Disponibles" value={hasData ? availableMachines : '—'} percent={hasData ? percent(availableMachines, totalMachines) : '—'} width={hasData ? percent(availableMachines, totalMachines) : '0%'} /><ParkRow label="En arriendo" value={hasData ? rentedMachines : '—'} percent={hasData ? percent(rentedMachines, totalMachines) : '—'} width={hasData ? percent(rentedMachines, totalMachines) : '0%'} /><ParkRow label="Mantenimiento" value={hasData ? maintenanceMachines : '—'} percent={hasData ? percent(maintenanceMachines, totalMachines) : '—'} width={hasData ? percent(maintenanceMachines, totalMachines) : '0%'} /><div className="empty-dashboard-state">{hasData ? 'Selecciona Reportes para consultar la evolución de uso.' : 'Sin datos del parque disponibles.'}</div></article>
      </section>
      {azureConfigured && dashboardData.loaded && !hasData && <div className="preview-note">El BFF está conectado, pero todavía no hay datos de maquinaria disponibles.</div>}
    </div>
  );
}

function WelcomeIdentity({ azureConfigured }) {
  if (!azureConfigured) {
    return <div><h2>Bienvenido al Sistema SRMM</h2><p>Configura Microsoft Entra ID para iniciar sesión.</p></div>;
  }

  return <WelcomeAccount />;
}

function WelcomeAccount() {
  const { accounts } = useMsal();
  const account = accounts[0];
  return <div><h2>Bienvenido al Sistema SRMM</h2><p>Sesión activa como: <strong>{account?.name || 'Usuario'}</strong> · {account?.username || 'Cuenta Microsoft'}</p></div>;
}

function MetricCard({ label, value, detail, tone }) {
  return <article className="metric-card"><span>{label}</span><strong className={`metric-${tone}`}>{value}</strong><small>{detail}</small></article>;
}

function ParkRow({ label, value, percent, width }) {
  return <div className="park-row"><span>{label}</span><div><i style={{ width }} /></div><strong>{value} <small>({percent})</small></strong></div>;
}

function percent(value, total) {
  return total ? `${Math.round((value / total) * 100)}%` : '0%';
}

function AuthenticatedHomeActions({ checkBff, status }) {
  const isAuthenticated = useIsAuthenticated();
  if (!isAuthenticated) return <div className="setup-note"><strong>Sesión pendiente</strong><span>Inicia sesión para probar los módulos.</span></div>;
  return <div className="identity-check"><button className="button button-secondary" type="button" onClick={checkBff}>Probar conexión segura</button>{status && <span>{status}</span>}</div>;
}
