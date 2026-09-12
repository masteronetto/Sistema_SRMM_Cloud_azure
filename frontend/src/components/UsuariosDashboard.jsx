import { useEffect, useState } from 'react';
import { listUsuarios, createUsuario, updateUsuario, deleteUsuario } from '../api/usuarios';
import { useIdentity } from '../auth/IdentityContext';

const emptyForm = {
  oid: '',
  nombre: '',
  correo: ''
};

export default function UsuariosDashboard() {
  const { profile } = useIdentity();
  const currentRole = profile?.roles?.[0] || '';
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingOid, setEditingOid] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  async function loadDashboard() {
    try {
      setLoading(true);
      const usuariosRows = await listUsuarios();
      setRows(Array.isArray(usuariosRows) ? usuariosRows : []);
      setStatus('');
    } catch (error) {
      setStatus(error.userMessage || error.response?.data?.message || 'No fue posible cargar usuarios del BFF.');
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
      if (editingOid) {
        const updated = await updateUsuario(editingOid, form);
        setRows((previous) => previous.map((row) => row.oid === updated.oid ? updated : row));
        setStatus('Usuario actualizado.');
      } else {
        const created = await createUsuario(form);
        setRows((previous) => [created, ...previous.filter((row) => row.oid !== created.oid)]);
        setStatus('Usuario sincronizado.');
      }
      setForm(emptyForm);
      setEditingOid('');
    } catch (error) {
      setStatus(error.userMessage || error.response?.data?.message || 'No fue posible guardar el usuario.');
    } finally {
      setLoading(false);
    }
  }

  async function onDelete(oid) {
    try {
      setLoading(true);
      await deleteUsuario(oid);
      setRows((previous) => previous.filter((row) => row.oid !== oid));
      setStatus('Usuario eliminado.');
    } catch (error) {
      setStatus(error.userMessage || error.response?.data?.message || 'No fue posible eliminar el usuario.');
    } finally {
      setLoading(false);
    }
  }

  function onEdit(row) {
    setEditingOid(row.oid);
    setForm({ oid: row.oid, nombre: row.nombre, correo: row.correo });
    setStatus('Editando usuario.');
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingOid('');
    setStatus('');
  }

  return (
    <section className="module-view usuarios-dashboard">
      <div className="view-heading">
        <div>
          <h1>Usuarios</h1>
        </div>
        <div className="role-badge">{currentRole || 'Rol pendiente'}</div>
      </div>

      {status && <div className="status-message">{status}</div>}

      <section className="machinery-panel">
        <div className="panel-toolbar">
          <div>
            <h2>{editingOid ? 'Editar identidad' : 'Registro de identidad'}</h2>
            <p>Sincronización del directorio cloud</p>
          </div>
        </div>

        <form className="entity-form arriendo-form" onSubmit={onSubmit}>
          <div className="arriendo-form-grid">
            <label className="arriendo-form-field">
              <span>OID Entra</span>
              <input value={form.oid} onChange={(e) => setForm({ ...form, oid: e.target.value })} required disabled={Boolean(editingOid)} />
            </label>
            <label className="arriendo-form-field">
              <span>Nombre completo</span>
              <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
            </label>
            <label className="arriendo-form-field">
              <span>Correo</span>
              <input type="email" value={form.correo} onChange={(e) => setForm({ ...form, correo: e.target.value })} required />
            </label>
          </div>
          <div className="form-actions">
            <button className="button button-primary" type="submit" disabled={loading}>{editingOid ? 'Actualizar usuario' : 'Guardar usuario'}</button>
            <button className="button button-secondary" type="button" onClick={resetForm}>Limpiar</button>
            {editingOid && (
              <button className="button button-secondary" type="button" onClick={resetForm}>Cancelar edición</button>
            )}
          </div>
        </form>
      </section>

      <section className="machinery-panel">
        <div className="panel-toolbar">
          <div>
            <h2>Usuarios registrados</h2>
            <p>{loading ? 'Cargando...' : `${rows.length} usuario(s)`}</p>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>OID</th>
                <th>Nombre</th>
                <th>Correo</th>
                <th>Último acceso</th>
                <th>Creado</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan="6" className="empty-row">Sin usuarios registrados.</td></tr>
              ) : rows.map((row) => (
                <tr key={row.oid}>
                  <td><strong>{row.oid}</strong></td>
                  <td>{row.nombre}</td>
                  <td>{row.correo}</td>
                  <td>{row.ultimo_acceso ? new Date(row.ultimo_acceso).toLocaleString('es-CL') : '—'}</td>
                  <td>{row.creado_en ? new Date(row.creado_en).toLocaleString('es-CL') : '—'}</td>
                  <td>
                    <div className="table-actions">
                      <button className="table-action" onClick={() => onEdit(row)}>Editar</button>
                      <button className="table-action" onClick={() => onDelete(row.oid)}>Eliminar</button>
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
