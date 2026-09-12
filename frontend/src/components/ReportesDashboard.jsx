import { useEffect, useRef, useState } from 'react';
import { useIsAuthenticated } from '@azure/msal-react';
import Chart from 'chart.js/auto';
import { downloadReport, getReportData } from '../api/reportes';
import { getMaintenanceHistory } from '../api/mantenimientos';
import { useIdentity } from '../auth/IdentityContext';

function formatNumber(value, suffix = '') {
  const numeric = Number(value || 0);
  return `${Number.isFinite(numeric) ? numeric.toLocaleString('es-CL') : '0'}${suffix}`;
}

function formatCurrency(value) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(value || 0));
}

export default function ReportesDashboard() {
  const { profile } = useIdentity();
  const isAuthenticated = useIsAuthenticated();
  const role = profile?.roles?.[0] || '';
  const isAdmin = ['Administrador', 'Admin'].includes(role);
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const [stats, setStats] = useState([]);
  const [machines, setMachines] = useState([]);
  const [authors, setAuthors] = useState([]);
  const [income, setIncome] = useState([]);
  const [history, setHistory] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [selectedMachine, setSelectedMachine] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    setLoading(true);
    const today = new Date();
    const end = today.toISOString().slice(0, 10);
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 30);
    const start = startDate.toISOString().slice(0, 10);

    Promise.allSettled([
      getReportData('/reportes/estadisticas'),
      getReportData('/reportes/top-maquinas'),
      getReportData('/reportes/autores', { fecha_inicio: start, fecha_fin: end }),
      getReportData('/reportes/alertas-criticas'),
      getMaintenanceHistory(1, { page: 1, per_page: 4, order: 'desc', fecha_inicio: start, fecha_fin: end })
    ])
      .then(([statsResult, machinesResult, authorsResult, alertsResult, historyResult]) => {
        if (statsResult.status === 'fulfilled') setStats(Array.isArray(statsResult.value) ? statsResult.value : []);
        if (machinesResult.status === 'fulfilled') setMachines(Array.isArray(machinesResult.value) ? machinesResult.value : []);
        if (authorsResult.status === 'fulfilled') setAuthors(Array.isArray(authorsResult.value) ? authorsResult.value : []);
        if (alertsResult.status === 'fulfilled') setAlerts(Array.isArray(alertsResult.value) ? alertsResult.value : []);
        if (historyResult.status === 'fulfilled') {
          const data = Array.isArray(historyResult.value?.data) ? historyResult.value.data : [];
          setHistory(data);
        }

        if (isAdmin && statsResult.status === 'fulfilled' && machinesResult.status === 'fulfilled' && authorsResult.status === 'fulfilled') {
          return getReportData('/reportes/ingresos', { fecha_inicio: start, fecha_fin: end });
        }
        return null;
      })
      .then((incomePayload) => {
        if (incomePayload) {
          const nextIncome = Array.isArray(incomePayload.by_maquina) ? incomePayload.by_maquina : [];
          setIncome(nextIncome);
        }
      })
      .catch((error) => {
        setStats([]);
        setMachines([]);
        setAuthors([]);
        setIncome([]);
        setHistory([]);
        setAlerts([]);
        setStatus(error?.userMessage || error?.response?.data?.message || 'No se pudieron cargar los datos del reporte desde el BFF.');
      })
      .finally(() => setLoading(false));
    return undefined;
  }, [isAuthenticated, isAdmin]);

  useEffect(() => {
    if (!selectedMachine) {
      chartInstance.current?.destroy();
      chartInstance.current = null;
      return undefined;
    }
    getReportData(`/reportes/uso-historico/${selectedMachine}`)
      .then((payload) => {
        chartInstance.current?.destroy();
        const context = chartRef.current?.getContext('2d');
        if (!context) return;
        chartInstance.current = new Chart(context, { type: 'line', data: { labels: payload.map((item) => new Date(item.fecha_registro).toLocaleDateString('es-CL')), datasets: [{ label: 'Horas acumuladas', data: payload.map((item) => Number(item.valor_horas) || 0), borderColor: '#6d5141', backgroundColor: 'rgba(109,81,65,.12)', fill: true, tension: .3 }] }, options: { responsive: true, maintainAspectRatio: false } });
      })
      .catch(() => setStatus('No se pudo cargar la evolución de uso.'));
    return () => chartInstance.current?.destroy();
  }, [selectedMachine]);

  async function exportIncome() {
    try {
      const response = await downloadReport('/reportes/ingresos/csv');
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'ingresos.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setStatus(error.userMessage || error.response?.data?.message || 'No se pudo descargar el CSV.');
    }
  }

  return (
    <section className="module-view report-view">
      <div className="view-heading"><div><h1>Reportes</h1></div><div className="role-badge">{role || 'Rol pendiente'}</div></div>
      {status && <div className="status-message">{status}</div>}
      <div className="metric-grid report-metric-grid">
        <article className="metric-card report-metric-card"><span>Máquinas analizadas</span><strong>{loading ? '...' : formatNumber(stats.length)}</strong></article>
        <article className="metric-card report-metric-card"><span>Autores activos</span><strong>{loading ? '...' : formatNumber(authors.length)}</strong></article>
        <article className="metric-card report-metric-card"><span>Ganancias visibles</span><strong>{isAdmin ? formatCurrency(income.reduce((total, item) => total + Number(item.ingresos || 0), 0)) : 'Restringido'}</strong></article>
      </div>
      <div className="report-grid">
        <section className="machinery-panel">
          <div className="panel-toolbar"><div><h2>Máquinas más utilizadas</h2><p>{loading ? 'Cargando...' : `${machines.length} máquinas`}</p></div></div>
          <div className="table-wrap"><table><thead><tr><th>Modelo</th><th>Horómetro</th><th>Estado</th></tr></thead><tbody>{machines.length === 0 ? <tr><td colSpan="3" className="empty-row">Sin datos disponibles.</td></tr> : machines.map((machine) => <tr key={machine.id_maquina}><td><strong>{machine.modelo_equipo}</strong></td><td>{formatNumber(machine.horometro_actual, ' hrs')}</td><td>{machine.estado || '—'}</td></tr>)}</tbody></table></div>
        </section>
        <section className="machinery-panel chart-panel">
          <div className="panel-toolbar"><div><h2>Evolución de uso</h2><p>Selecciona una máquina para consultar su historial.</p></div></div>
          <select value={selectedMachine} onChange={(event) => setSelectedMachine(event.target.value)}><option value="">Selecciona una máquina</option>{machines.map((machine) => <option key={machine.id_maquina} value={machine.id_maquina}>{machine.modelo_equipo}</option>)}</select>
          <div className="chart-container"><canvas ref={chartRef} /></div>
        </section>
      </div>
      <section className="machinery-panel">
        <div className="panel-toolbar"><div><h2>Correlación de mantenimiento</h2><p>Resumen de horas, mantenciones y fallas por equipo.</p></div></div>
        <div className="table-wrap"><table><thead><tr><th>Máquina</th><th>Horas</th><th>Mantenciones</th><th>Fallas</th></tr></thead><tbody>{stats.length === 0 ? <tr><td colSpan="4" className="empty-row">Sin estadísticas disponibles.</td></tr> : stats.map((item) => <tr key={item.id_maquina}><td><strong>{item.modelo_equipo}</strong></td><td>{formatNumber(item.horometro_actual, ' hrs')}</td><td>{formatNumber(item.total_mantenciones)}</td><td>{formatNumber(item.total_fallas)}</td></tr>)}</tbody></table></div>
      </section>
      <section className="report-compact-grid">
        <article className="machinery-panel report-compact-panel">
          <div className="panel-toolbar"><div><h2>Historial de mantenciones</h2><p>Últimas operaciones de servicio</p></div></div>
          <div className="timeline-list">
            {history.length === 0 ? (
              <div className="empty-row">Sin historial de mantenimiento disponible.</div>
            ) : history.map((row, index) => (
              <div className="timeline-row" key={`${row.id_registro || row.modelo_equipo}-${index}`}>
                <span className="timeline-dot" />
                <div>
                  <strong>{row.modelo_equipo || row.maquinaria_id_maquina}</strong>
                  <span>{row.fecha_registro || row.fecha_servicio} · {row.tipo_servicio || 'Servicio'}</span>
                  <small>{Number(row.valor_horas || 0)} hrs · {row.id_usuario || row.usuarios_id_usuario || 'Usuario'}</small>
                </div>
              </div>
            ))}
          </div>
        </article>
        <article className="machinery-panel report-compact-panel">
          <div className="panel-toolbar"><div><h2>Alertas críticas</h2><p>Revisión del parque</p></div></div>
          <div className="alert-list">
            {alerts.length === 0 ? (
              <div className="empty-row">Sin alertas críticas disponibles.</div>
            ) : alerts.map((alert, index) => (
              <div className="critical-alert" key={`${alert.id_incidencia || alert.descripcion}-${index}`}>
                <span className="critical-icon">!</span>
                <div>
                  <strong>{alert.modelo_equipo || 'Máquina'} · {alert.criticidad || 'Alta'}</strong>
                  <span>{alert.estado || 'Pendiente'} · {alert.fecha || 'Sin fecha'}</span>
                  <span>{alert.descripcion || 'Revisión requerida.'}</span>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>
      {isAdmin && <section className="machinery-panel"><div className="panel-toolbar"><div><h2>Ingresos por máquina</h2><p>Vista reservada para administradores.</p></div><button className="button button-secondary" type="button" onClick={exportIncome}>Descargar CSV</button></div><div className="table-wrap"><table><thead><tr><th>Máquina</th><th>Contratos</th><th>Ingresos</th></tr></thead><tbody>{income.length === 0 ? <tr><td colSpan="3" className="empty-row">Sin ingresos disponibles.</td></tr> : income.map((item) => <tr key={item.id_maquina}><td>{item.modelo_equipo}</td><td>{item.contratos}</td><td>{formatCurrency(item.ingresos)}</td></tr>)}</tbody></table></div></section>}
    </section>
  );
}
