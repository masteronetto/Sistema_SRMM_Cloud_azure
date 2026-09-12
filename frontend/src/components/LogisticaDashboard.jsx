import { useEffect, useState } from 'react';
import { listLogistica, createLogistica, updateLogistica, deleteLogistica } from '../api/logistica';
import { listMaquinaria } from '../api/maquinaria';
import { useIdentity } from '../auth/IdentityContext';

const emptyForm = {
  titulo: '',
  equipo: '',
  cliente: '',
  ruta: '',
  hora_evento: '',
  estado_evento: 'Pendiente',
  maquinaria_id_maquina: '',
  arriendos_id_contrato: ''
};

export default function LogisticaDashboard() {
  const { profile } = useIdentity();
  const currentRole = profile?.roles?.[0] || '';

  const [rows, setRows] = useState([]);
  const [machines, setMachines] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  async function loadDashboard() {
    try {
      setLoading(true);
      const [logisticaRows, maquinariaRows] = await Promise.all([
        listLogistica(),
        listMaquinaria()
      ]);
      setRows(Array.isArray(logisticaRows) ? logisticaRows : []);
      setMachines(Array.isArray(maquinariaRows) ? maquinariaRows : []);
      setStatus('');
    } catch (error) {
      setStatus(error.userMessage || error.response?.data?.message || 'No fue posible cargar logística del BFF.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  async function onSubmit(event) {
    event.preventDefault();
    try {
      setLoading(true);
      const payload = {
        ...form,
        maquinaria_id_maquina: form.maquinaria_id_maquina === '' ? null : Number(form.maquinaria_id_maquina),
        arriendos_id_contrato: form.arriendos_id_contrato === '' ? null : Number(form.arriendos_id_contrato)
      };
      if (editingId) {
        const updated = await updateLogistica(editingId, payload);
        setRows((previous) => previous.map((row) => row.id_evento === editingId ? updated : row));
        setStatus('Evento de logística actualizado.');
      } else {
        const created = await createLogistica(payload);
        setRows((previous) => [created, ...previous]);
        setStatus('Evento de logística creado.');
      }
      setForm(emptyForm);
      setEditingId(null);
    } catch (error) {
      setStatus(error.userMessage || error.response?.data?.message || 'No fue posible crear el evento de logística.');
    } finally {
      setLoading(false);
    }
  }

  function onEdit(row) {
    setEditingId(row.id_evento);
    setForm({
      titulo: row.titulo || '',
      equipo: row.equipo || '',
      cliente: row.cliente || '',
      ruta: row.ruta || '',
      hora_evento: row.hora_evento || '',
      estado_evento: row.estado_evento || 'Pendiente',
      maquinaria_id_maquina: row.maquinaria_id_maquina ?? '',
      arriendos_id_contrato: row.arriendos_id_contrato ?? ''
    });
    setStatus('Editando evento de logística.');
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setStatus('');
  }

  async function onDelete(id) {
    try {
      setLoading(true);
      await deleteLogistica(id);
      setRows((previous) => previous.filter((row) => row.id_evento !== id));
      setStatus('Evento eliminado.');
    } catch (error) {
      setStatus(error.userMessage || error.response?.data?.message || 'No fue posible eliminar el evento.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="module-view logistica-dashboard">
      <div className="view-heading">
        <div>
          <h1>Logística</h1>
        </div>
        <div className="role-badge">{currentRole || 'Rol pendiente'}</div>
      </div>

      {status && <div className="status-message">{status}</div>}

      <section className="machinery-panel">
        <div className="panel-toolbar">
          <div>
            <h2>{editingId ? 'Editar evento' : 'Crear evento'}</h2>
            <p>Registro de coordinación y rutas de logística</p>
          </div>
        </div>

        <form className="entity-form arriendo-form" onSubmit={onSubmit}>
          <div className="arriendo-form-grid logistica-form-grid">
            <label className="arriendo-form-field">
              <span>Título</span>
              <input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} required />
            </label>
            <label className="arriendo-form-field">
              <span>Equipo</span>
              <input value={form.equipo} onChange={(e) => setForm({ ...form, equipo: e.target.value })} required />
            </label>
            <label className="arriendo-form-field">
              <span>Cliente</span>
              <input value={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.value })} />
            </label>
            <label className="arriendo-form-field">
              <span>Ruta</span>
              <input value={form.ruta} onChange={(e) => setForm({ ...form, ruta: e.target.value })} required />
            </label>
            <label className="arriendo-form-field">
              <span>Fecha/Hora</span>
              <input type="datetime-local" value={form.hora_evento} onChange={(e) => setForm({ ...form, hora_evento: e.target.value })} required />
            </label>
            <label className="arriendo-form-field">
              <span>Estado</span>
              <select value={form.estado_evento} onChange={(e) => setForm({ ...form, estado_evento: e.target.value })}>
                <option key="Pendiente" value="Pendiente">Pendiente</option>
                <option key="Confirmado" value="Confirmado">Confirmado</option>
                <option key="En Ruta" value="En Ruta">En Ruta</option>
                <option key="Completado" value="Completado">Completado</option>
                <option key="Cancelado" value="Cancelado">Cancelado</option>
              </select>
            </label>
            <label className="arriendo-form-field">
              <span>Máquina</span>
              <select value={form.maquinaria_id_maquina} onChange={(e) => setForm({ ...form, maquinaria_id_maquina: e.target.value })}>
                <option value="">Sin máquina</option>
                {machines.map((machine) => <option value={machine.id} key={machine.id}>{machine.modelo_equipo}</option>)}
              </select>
            </label>
            <label className="arriendo-form-field">
              <span>Contrato</span>
              <input type="number" min="1" value={form.arriendos_id_contrato} onChange={(e) => setForm({ ...form, arriendos_id_contrato: e.target.value })} />
            </label>
          </div>

          <div className="form-actions">
            <button className="button button-primary" type="submit" disabled={loading}>{editingId ? 'Actualizar evento' : 'Guardar evento'}</button>
            <button className="button button-secondary" type="button" onClick={resetForm}>Limpiar</button>
            {editingId && (
              <button className="button button-secondary" type="button" onClick={resetForm}>Cancelar edición</button>
            )}
          </div>
        </form>
      </section>

      <section className="machinery-panel">
        <div className="panel-toolbar">
          <div>
            <h2>Eventos registrados</h2>
            <p>{loading ? 'Cargando...' : `${rows.length} evento(s)`}</p>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Título</th>
                <th>Equipo</th>
                <th>Cliente</th>
                <th>Ruta</th>
                <th>Hora</th>
                <th>Estado</th>
                <th>Máquina</th>
                <th>Contrato</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan="10" className="empty-row">Sin eventos de logística disponibles.</td></tr>
              ) : rows.map((row) => (
                <tr key={row.id_evento}>
                  <td><strong>{row.id_evento}</strong></td>
                  <td>{row.titulo}</td>
                  <td>{row.equipo}</td>
                  <td>{row.cliente}</td>
                  <td>{row.ruta}</td>
                  <td>{row.hora_evento}</td>
                  <td>{row.estado_evento}</td>
                  <td>{row.maquinaria_id_maquina ?? '—'}</td>
                  <td>{row.arriendos_id_contrato ?? '—'}</td>
                  <td>
                    <div className="table-actions">
                      <button className="table-action" type="button" onClick={() => onEdit(row)}>Editar</button>
                      <button className="table-action" type="button" onClick={() => onDelete(row.id_evento)}>Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
