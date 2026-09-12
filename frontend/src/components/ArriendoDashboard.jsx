import { useEffect, useMemo, useState } from 'react';
import { useIsAuthenticated } from '@azure/msal-react';
import { listMaquinaria } from '../api/maquinaria';
import { createArriendo, deleteArriendo, listArriendos, listMisContratos } from '../api/arriendos';
import { useIdentity } from '../auth/IdentityContext';

const initialForm = {
  maquinaria_id_maquina: '',
  cliente_id: '',
  horometro_entrada: '',
  horometro_salida: '',
  fecha_inicio: '',
  fecha_fin: '',
  estado_contrato: 'Activo'
};

export default function ArriendoDashboard() {
  const { profile } = useIdentity();
  const isAuthenticated = useIsAuthenticated();
  const currentRole = profile?.roles?.[0] || '';
  const isAdmin = useMemo(() => ['Administrador', 'Admin'].includes(currentRole), [currentRole]);

  const [machines, setMachines] = useState([]);
  const [arriendos, setArriendos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [form, setForm] = useState(initialForm);

  async function loadDashboard() {
    if (!isAuthenticated) {
      setStatus('Inicia sesión con Microsoft para consultar arriendos.');
      return;
    }

    setLoading(true);
    setStatus('');
    try {
      const [machineRows, arriendoRows, userRows] = await Promise.all([
        listMaquinaria(),
        listArriendos(),
        listMisContratos()
      ]);

      setMachines(Array.isArray(machineRows) ? machineRows : []);
      setArriendos(Array.isArray(arriendoRows) ? arriendoRows : []);
      if (Array.isArray(userRows) && userRows.length > 0) {
        setStatus(`Mostrando ${userRows.length} contrato(s) asociados a tu perfil.`);
      }
    } catch (error) {
      setStatus(error.userMessage || error.response?.data?.message || 'No fue posible cargar el contrato de arriendos del BFF.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, [isAuthenticated]);

  function updateForm(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (!isAuthenticated) {
      setStatus('Debes iniciar sesión para crear un arriendo.');
      return;
    }

    if (!isAdmin) {
      setStatus('La creación de arriendos requiere el rol Administrador.');
      return;
    }

    const payload = {
      maquinaria_id_maquina: Number(form.maquinaria_id_maquina),
      cliente_id: Number(form.cliente_id),
      horometro_entrada: form.horometro_entrada === '' ? null : Number(form.horometro_entrada),
      horometro_salida: form.horometro_salida === '' ? null : Number(form.horometro_salida),
      fecha_inicio: form.fecha_inicio || null,
      fecha_fin: form.fecha_fin || null,
      estado_contrato: form.estado_contrato || 'Activo'
    };

    try {
      setStatus('Creando contrato...');
      const created = await createArriendo(payload);
      setArriendos((previous) => [created, ...previous]);
      setForm(initialForm);
      setStatus('Contrato de arriendo creado correctamente.');
    } catch (error) {
      setStatus(error.userMessage || error.response?.data?.message || 'No fue posible crear el contrato.');
    }
  }

  async function onDelete(id) {
    if (!isAdmin) {
      setStatus('La eliminación de arriendos requiere el rol Administrador.');
      return;
    }

    if (!window.confirm('¿Deseas eliminar este contrato de arriendo?')) return;

    try {
      await deleteArriendo(id);
      setArriendos((previous) => previous.filter((item) => item.id_contrato !== id));
      setStatus('Contrato eliminado.');
    } catch (error) {
      setStatus(error.userMessage || error.response?.data?.message || 'No fue posible eliminar el contrato.');
    }
  }

  return (
    <section className="module-view arriendo-dashboard">
      <div className="view-heading">
        <div>
          <p className="eyebrow">Dominio de contratos</p>
          <h1>Arriendos</h1>
          <p className="view-copy">Contratos reales, máquinas disponibles y clientes asociados al BFF.</p>
        </div>
        <div className="role-badge">{currentRole || 'Rol pendiente'}</div>
      </div>

      {status && <div className="status-message">{status}</div>}

      <section className="machinery-panel">
        <div className="panel-toolbar">
          <div>
            <h2>Crear contrato</h2>
            <p>{isAdmin ? 'Registro administrativo' : 'Solo administradores pueden escribir contratos'}</p>
          </div>
        </div>

        <form className="entity-form arriendo-form" onSubmit={onSubmit}>
          <div className="arriendo-form-grid">
            <label className="arriendo-form-field">
              <span>Máquina</span>
              <select name="maquinaria_id_maquina" value={form.maquinaria_id_maquina} onChange={updateForm} required>
                <option value="">Selecciona una máquina</option>
                {machines.map((machine) => (
                  <option key={machine.id_maquina} value={machine.id_maquina}>{machine.modelo_equipo || machine.id_maquina}</option>
                ))}
              </select>
            </label>

            <label className="arriendo-form-field">
              <span>Cliente</span>
              <input type="number" name="cliente_id" value={form.cliente_id} onChange={updateForm} placeholder="ID de cliente" required />
            </label>

            <label className="arriendo-form-field">
              <span>Horómetro entrada</span>
              <input type="number" step="0.01" min="0" name="horometro_entrada" value={form.horometro_entrada} onChange={updateForm} />
            </label>

            <label className="arriendo-form-field">
              <span>Horómetro salida</span>
              <input type="number" step="0.01" min="0" name="horometro_salida" value={form.horometro_salida} onChange={updateForm} />
            </label>

            <label className="arriendo-form-field">
              <span>Fecha inicio</span>
              <input type="date" name="fecha_inicio" value={form.fecha_inicio} onChange={updateForm} required />
            </label>

            <label className="arriendo-form-field">
              <span>Fecha fin</span>
              <input type="date" name="fecha_fin" value={form.fecha_fin} onChange={updateForm} />
            </label>

            <label className="arriendo-form-field">
              <span>Estado</span>
              <select name="estado_contrato" value={form.estado_contrato} onChange={updateForm}>
                <option value="Activo">Activo</option>
                <option value="Finalizado">Finalizado</option>
                <option value="Cancelado">Cancelado</option>
              </select>
            </label>
          </div>

          <div className="form-actions">
            <button className="button button-primary" type="submit" disabled={!isAdmin || loading}>Confirmar arriendo</button>
            <button className="button button-secondary" type="button" onClick={() => setForm(initialForm)}>Limpiar</button>
          </div>
        </form>
      </section>

      <section className="machinery-panel">
        <div className="panel-toolbar">
          <div>
            <h2>Contratos activos</h2>
            <p>{loading ? 'Cargando...' : `${arriendos.length} contrato(s)`}</p>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Contrato</th>
                <th>Máquina</th>
                <th>Cliente</th>
                <th>Inicio</th>
                <th>Fin</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {arriendos.length === 0 ? (
                <tr><td colSpan="7" className="empty-row">Sin contratos disponibles.</td></tr>
              ) : arriendos.map((item) => (
                <tr key={item.id_contrato}>
                  <td><strong>{item.id_contrato}</strong></td>
                  <td>{item.modelo_equipo || item.maquinaria_id_maquina}</td>
                  <td>{item.cliente_nombre || item.cliente_id}</td>
                  <td>{item.fecha_inicio || '—'}</td>
                  <td>{item.fecha_fin || '—'}</td>
                  <td>{item.estado_contrato || 'Activo'}</td>
                  <td>
                    <button className="button button-danger button-small" type="button" disabled={!isAdmin} onClick={() => onDelete(item.id_contrato)}>Eliminar</button>
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
