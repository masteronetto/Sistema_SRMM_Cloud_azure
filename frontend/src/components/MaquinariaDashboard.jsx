import { useEffect, useMemo, useState } from 'react';
import { useIsAuthenticated, useMsal } from '@azure/msal-react';
import { createMaquinaria, listMaquinaria, updateMaquinaria } from '../api/maquinaria';

const initialForm = {
  modelo_equipo: '',
  horometro_actual: '',
  estado: 'Disponible',
  especificaciones: '',
  planes_mantencion_id_plan: '',
  tarifa_diaria: ''
};

function formatCurrency(value) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric)
    ? new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(numeric)
    : '$0';
}

function formatNumber(value) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? numeric.toLocaleString('es-CL') : '0';
}

function getRole(account) {
  const claims = account?.idTokenClaims || {};
  return claims.roles?.[0] || claims.rol_acceso || '';
}

export default function MaquinariaDashboard() {
  const { accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const account = accounts[0];
  const currentRole = getRole(account);
  const isAdmin = useMemo(() => ['Administrador', 'Admin'].includes(currentRole), [currentRole]);
  const [maquinaria, setMaquinaria] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedMachineId, setSelectedMachineId] = useState('');
  const [formMode, setFormMode] = useState('create');
  const [formData, setFormData] = useState(initialForm);
  const [status, setStatus] = useState('');

  async function loadMaquinaria() {
    if (!isAuthenticated) {
      setStatus('Inicia sesión con Microsoft para consultar maquinaria.');
      return;
    }

    setLoading(true);
    setStatus('');
    try {
      setMaquinaria(await listMaquinaria());
    } catch (error) {
      setStatus(error.response?.data?.message || 'El BFF aún no expone maquinaria.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMaquinaria();
  }, [isAuthenticated]);

  function resetForm() {
    setSelectedMachineId('');
    setFormMode('create');
    setFormData(initialForm);
    setStatus('');
  }

  function selectMachine(machine) {
    setSelectedMachineId(machine.id_maquina);
    setFormMode('edit');
    setFormData({
      modelo_equipo: machine.modelo_equipo || '',
      horometro_actual: machine.horometro_actual ?? '',
      estado: machine.estado || 'Disponible',
      especificaciones: machine.especificaciones || '',
      planes_mantencion_id_plan: machine.planes_mantencion_id_plan ?? '',
      tarifa_diaria: machine.tarifa_diaria ?? ''
    });
    setStatus(`Editando ${machine.modelo_equipo}`);
  }

  function updateField(field, event) {
    setFormData((current) => ({ ...current, [field]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!isAdmin) {
      setStatus('Tu cuenta no tiene permisos para modificar maquinaria.');
      return;
    }
    if (!formData.modelo_equipo.trim()) {
      setStatus('El modelo es obligatorio.');
      return;
    }

    const payload = {
      ...formData,
      modelo_equipo: formData.modelo_equipo.trim(),
      especificaciones: formData.especificaciones.trim(),
      planes_mantencion_id_plan: formData.planes_mantencion_id_plan || null,
      tarifa_diaria: formData.tarifa_diaria || null
    };

    try {
      const saved = formMode === 'edit'
        ? await updateMaquinaria(selectedMachineId, payload)
        : await createMaquinaria(payload);
      setStatus(`${formMode === 'edit' ? 'Actualizada' : 'Creada'}: ${saved.modelo_equipo}`);
      await loadMaquinaria();
      if (formMode === 'create') resetForm();
    } catch (error) {
      setStatus(error.response?.data?.message || 'No se pudo guardar la maquinaria.');
    }
  }

  return (
    <section className="machinery-view">
      <div className="view-heading">
        <div>
          <p className="eyebrow">Dominio operativo</p>
          <h1>Maquinaria</h1>
          <p className="view-copy">Consulta centralizada de equipos. La edición depende del rol entregado por Microsoft Entra ID.</p>
        </div>
        <div className="role-badge">{currentRole || 'Rol pendiente'}</div>
      </div>

      <div className="machinery-layout">
        <div className="machinery-panel">
          <div className="panel-toolbar">
            <div>
              <h2>Equipos registrados</h2>
              <p>{loading ? 'Cargando...' : `${maquinaria.length} equipos disponibles`}</p>
            </div>
            <button className="button button-quiet" type="button" onClick={loadMaquinaria}>Actualizar</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Modelo</th><th>Estado</th><th>Horómetro</th><th>Tarifa</th><th>Acción</th></tr></thead>
              <tbody>
                {!loading && maquinaria.length === 0 && <tr><td colSpan="5" className="empty-row">No hay datos. El BFF debe conectar el repositorio de maquinaria.</td></tr>}
                {maquinaria.map((machine) => (
                  <tr key={machine.id_maquina}>
                    <td><strong>{machine.modelo_equipo}</strong></td>
                    <td>{machine.estado}</td>
                    <td>{formatNumber(machine.horometro_actual)} hrs</td>
                    <td>{formatCurrency(machine.tarifa_diaria)}</td>
                    <td>{isAdmin ? <button className="table-action" type="button" onClick={() => selectMachine(machine)}>Editar</button> : 'Solo lectura'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <form className="machinery-panel machinery-form" onSubmit={handleSubmit}>
          <div className="panel-toolbar"><div><h2>{formMode === 'edit' ? 'Editar equipo' : 'Nuevo equipo'}</h2><p>{isAdmin ? 'Cambios autorizados para administradores.' : 'Tu rol permite consultar, no editar.'}</p></div></div>
          <label>Modelo<input value={formData.modelo_equipo} onChange={(event) => updateField('modelo_equipo', event)} disabled={!isAdmin} /></label>
          <div className="form-row"><label>Horómetro<input type="number" min="0" step="0.01" value={formData.horometro_actual} onChange={(event) => updateField('horometro_actual', event)} disabled={!isAdmin} /></label><label>Estado<select value={formData.estado} onChange={(event) => updateField('estado', event)} disabled={!isAdmin}><option>Disponible</option><option>Arrendada</option><option>Mantencion</option><option>Bloqueada</option><option>No Operativa</option></select></label></div>
          <div className="form-row"><label>Tarifa diaria<input type="number" min="0" step="0.01" value={formData.tarifa_diaria} onChange={(event) => updateField('tarifa_diaria', event)} disabled={!isAdmin} /></label><label>Plan ID<input type="number" min="0" step="1" value={formData.planes_mantencion_id_plan} onChange={(event) => updateField('planes_mantencion_id_plan', event)} disabled={!isAdmin} /></label></div>
          <label>Especificaciones<textarea value={formData.especificaciones} onChange={(event) => updateField('especificaciones', event)} disabled={!isAdmin} /></label>
          <div className="form-actions"><button className="button button-primary" type="submit" disabled={!isAdmin}>{formMode === 'edit' ? 'Guardar cambios' : 'Crear equipo'}</button><button className="button button-quiet" type="button" onClick={resetForm}>Limpiar</button></div>
          {status && <p className="form-status">{status}</p>}
        </form>
      </div>
    </section>
  );
}
