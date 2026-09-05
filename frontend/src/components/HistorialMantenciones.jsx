import { useEffect, useMemo, useState } from 'react';
import { useIsAuthenticated, useMsal } from '@azure/msal-react';
import { downloadMaintenanceHistory, getMaintenanceHistory, getServiceTypes } from '../api/mantenimientos';

function getRole(account) {
  return account?.idTokenClaims?.roles?.[0] || account?.idTokenClaims?.rol_acceso || '';
}

function downloadBlob(response, fallbackName) {
  const disposition = response.headers['content-disposition'] || '';
  const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] || fallbackName;
  const url = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function HistorialMantenciones() {
  const { accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const role = getRole(accounts[0]);
  const canGenerateReport = ['Administrador', 'Mecanico', 'Operador', 'Admin'].includes(role);
  const [machineId, setMachineId] = useState('');
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [order, setOrder] = useState('desc');
  const [fechaFrom, setFechaFrom] = useState('');
  const [fechaTo, setFechaTo] = useState('');
  const [tipoServicio, setTipoServicio] = useState('');
  const [serviceTypes, setServiceTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [status, setStatus] = useState('');

  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const query = useMemo(() => ({ page, per_page: perPage, order, fecha_inicio: fechaFrom || undefined, fecha_fin: fechaTo || undefined, tipo_servicio: tipoServicio || undefined }), [page, perPage, order, fechaFrom, fechaTo, tipoServicio]);

  useEffect(() => {
    getServiceTypes().then(setServiceTypes).catch(() => setServiceTypes([]));
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !machineId) {
      setRows([]);
      setTotal(0);
      return;
    }
    setLoading(true);
    setStatus('');
    getMaintenanceHistory(machineId, query)
      .then((payload) => {
        setRows(Array.isArray(payload.data) ? payload.data : []);
        setTotal(Number(payload.total || payload.cantidad || 0));
      })
      .catch((error) => setStatus(error.response?.data?.message || 'El BFF aún no expone el historial.'))
      .finally(() => setLoading(false));
  }, [isAuthenticated, machineId, query]);

  function clearFilters() {
    setFechaFrom('');
    setFechaTo('');
    setTipoServicio('');
    setPage(1);
  }

  async function exportCsv() {
    setReporting(true);
    try {
      const response = await downloadMaintenanceHistory(machineId, { ...query, format: 'csv' });
      downloadBlob(response, `historial_mantenciones_${machineId}.csv`);
    } catch (error) {
      setStatus(error.response?.data?.message || 'No se pudo generar el CSV.');
    } finally {
      setReporting(false);
    }
  }

  function exportPdf() {
    setReporting(true);
    import('jspdf').then(({ default: JsPDF }) => {
      const document = new JsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      document.setFontSize(16);
      document.text('Historial de Horómetro y Mantenciones', 40, 40);
      document.setFontSize(10);
      document.text(`Máquina: ${machineId} | Registros: ${total}`, 40, 60);
      let y = 90;
      rows.forEach((row) => {
        if (y > 540) { document.addPage(); y = 40; }
        document.text([row.fecha_registro, row.modelo_equipo || row.maquinaria_id_maquina, row.tipo_servicio || '-', `${row.valor_horas || 0} hrs`].join(' | ').slice(0, 130), 40, y);
        y += 16;
      });
      document.save(`historial_mantenciones_${machineId}.pdf`);
    }).catch(() => {
      setStatus('No se pudo cargar el exportador PDF.');
    }).finally(() => {
      setReporting(false);
    });
  }

  return (
    <section className="module-view">
      <div className="view-heading"><div><p className="eyebrow">Dominio técnico</p><h1>Historial de mantenciones</h1><p className="view-copy">Consulta paginada y exportable por máquina, con filtros de fecha y tipo de servicio.</p></div><div className="role-badge">{role || 'Rol pendiente'}</div></div>
      <div className="filter-panel">
        <label>Máquina ID<input type="number" min="1" value={machineId} onChange={(event) => { setMachineId(event.target.value); setPage(1); }} placeholder="Ej. 1" /></label>
        <label>Desde<input type="date" value={fechaFrom} onChange={(event) => { setFechaFrom(event.target.value); setPage(1); }} /></label>
        <label>Hasta<input type="date" value={fechaTo} onChange={(event) => { setFechaTo(event.target.value); setPage(1); }} /></label>
        <label>Tipo<select value={tipoServicio} onChange={(event) => { setTipoServicio(event.target.value); setPage(1); }}><option value="">Todos</option>{serviceTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
        <button className="button button-quiet" type="button" onClick={clearFilters}>Limpiar</button>
      </div>
      <div className="machinery-panel">
        <div className="panel-toolbar"><div><h2>Registros</h2><p>{machineId ? `${total} registros encontrados` : 'Indica una máquina para consultar.'}</p></div><div className="toolbar-actions"><label>Orden<select value={order} onChange={(event) => setOrder(event.target.value)}><option value="desc">Más reciente</option><option value="asc">Más antiguo</option></select></label><label>Por página<select value={perPage} onChange={(event) => { setPerPage(Number(event.target.value)); setPage(1); }}><option value="10">10</option><option value="25">25</option><option value="50">50</option></select></label></div></div>
        {canGenerateReport && machineId && <div className="form-actions report-actions"><button className="button button-secondary" type="button" disabled={reporting} onClick={exportCsv}>Exportar CSV</button><button className="button button-quiet" type="button" disabled={reporting || rows.length === 0} onClick={exportPdf}>Exportar PDF</button></div>}
        {status && <div className="status-message">{status}</div>}
        <div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Máquina</th><th>Tipo</th><th>Horómetro</th><th>Usuario</th><th>Arriendo</th></tr></thead><tbody>{loading ? <tr><td colSpan="6" className="empty-row">Cargando historial...</td></tr> : rows.length === 0 ? <tr><td colSpan="6" className="empty-row">No hay registros para los filtros seleccionados.</td></tr> : rows.map((row) => <tr key={row.id_registro}><td>{new Date(row.fecha_registro).toLocaleDateString('es-CL')}</td><td>{row.modelo_equipo || row.maquinaria_id_maquina}</td><td>{row.tipo_servicio || '-'}</td><td>{row.valor_horas || 0} hrs</td><td>{row.id_usuario || '-'}</td><td>{row.arriendos_id_contrato || '-'}</td></tr>)}</tbody></table></div>
        <div className="pagination"><button className="button button-quiet" type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Anterior</button><span>Página {page} de {totalPages}</span><button className="button button-quiet" type="button" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>Siguiente</button></div>
      </div>
    </section>
  );
}
