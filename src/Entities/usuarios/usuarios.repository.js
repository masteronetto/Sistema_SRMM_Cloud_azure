const pool = require('../../db/pool');

const baseSelect = `
  SELECT
    id_usuario,
    nombre_completo,
    email,
    rol_acceso,
    COALESCE((to_jsonb(usuarios) ->> 'activo')::boolean, TRUE) AS activo,
    created_at,
    updated_at
  FROM usuarios
`;

async function listUsuarios() {
  const query = `${baseSelect} ORDER BY id_usuario ASC`;
  const { rows } = await pool.query(query);
  return rows;
}

async function getUsuarioById(id) {
  const query = `${baseSelect} WHERE id_usuario = $1`;
  const { rows } = await pool.query(query, [id]);
  return rows[0] || null;
}

async function getUsuarioByEmail(email) {
  const query = `${baseSelect} WHERE email = $1 LIMIT 1`;
  const { rows } = await pool.query(query, [email]);
  return rows[0] || null;
}

async function createUsuario({ nombre_completo, email, contrasena, rol_acceso }) {
  const query = `
    INSERT INTO usuarios (nombre_completo, email, contrasena, rol_acceso)
    VALUES ($1, $2, $3, $4)
    RETURNING id_usuario, nombre_completo, email, rol_acceso, created_at, updated_at
  `;
  const values = [nombre_completo, email, contrasena, rol_acceso];
  const { rows } = await pool.query(query, values);
  return rows[0];
}

async function updateUsuario(id, { nombre_completo, email, contrasena, rol_acceso }) {
  const query = `
    UPDATE usuarios
    SET nombre_completo = $2,
        email = $3,
        contrasena = $4,
        rol_acceso = $5,
        updated_at = NOW()
    WHERE id_usuario = $1
    RETURNING id_usuario, nombre_completo, email, rol_acceso, created_at, updated_at
  `;
  const values = [id, nombre_completo, email, contrasena, rol_acceso];
  const { rows } = await pool.query(query, values);
  return rows[0] || null;
}

async function updateUsuarioPassword(id, contrasena) {
  const query = `
    UPDATE usuarios
    SET contrasena = $2,
        updated_at = NOW()
    WHERE id_usuario = $1
    RETURNING id_usuario, nombre_completo, email, rol_acceso, created_at, updated_at
  `;
  const values = [id, contrasena];
  const { rows } = await pool.query(query, values);
  return rows[0] || null;
}

async function updateUsuarioRole(id, rol_acceso) {
  const query = `
    UPDATE usuarios
    SET rol_acceso = $2,
        updated_at = NOW()
    WHERE id_usuario = $1
    RETURNING id_usuario, nombre_completo, email, rol_acceso, created_at, updated_at
  `;
  const values = [id, rol_acceso];
  const { rows } = await pool.query(query, values);
  return rows[0] || null;
}

async function updateUsuarioProfile(id, { nombre_completo, email }) {
  const query = `
    UPDATE usuarios
    SET nombre_completo = $2,
        email = $3,
        updated_at = NOW()
    WHERE id_usuario = $1
    RETURNING id_usuario, nombre_completo, email, rol_acceso, created_at, updated_at
  `;
  const values = [id, nombre_completo, email];
  const { rows } = await pool.query(query, values);
  return rows[0] || null;
}

async function deleteUsuario(id) {
  const query = 'DELETE FROM usuarios WHERE id_usuario = $1 RETURNING id_usuario';
  const { rowCount } = await pool.query(query, [id]);
  return rowCount > 0;
}

async function deactivateUsuario(id) {
  const query = `
    UPDATE usuarios
    SET activo = FALSE,
        updated_at = NOW()
    WHERE id_usuario = $1
    RETURNING id_usuario, nombre_completo, email, rol_acceso, activo, created_at, updated_at
  `;
  const { rows } = await pool.query(query, [id]);
  return rows[0] || null;
}

async function activateUsuario(id) {
  const query = `
    UPDATE usuarios
    SET activo = TRUE,
        updated_at = NOW()
    WHERE id_usuario = $1
    RETURNING id_usuario, nombre_completo, email, rol_acceso, activo, created_at, updated_at
  `;
  const { rows } = await pool.query(query, [id]);
  return rows[0] || null;
}

async function insertUsuarioAuditLog({ tipo_operacion, usuario_objetivo_id = null, ejecutado_por_id = null, detalle = {} }) {
  const query = `
    INSERT INTO auditoria_usuarios (tipo_operacion, usuario_objetivo_id, ejecutado_por_id, detalle)
    VALUES ($1, $2, $3, $4::jsonb)
    RETURNING id_auditoria, tipo_operacion, usuario_objetivo_id, ejecutado_por_id, detalle, created_at
  `;
  const values = [
    String(tipo_operacion || '').trim(),
    usuario_objetivo_id,
    ejecutado_por_id,
    JSON.stringify(detalle || {})
  ];
  const { rows } = await pool.query(query, values);
  return rows[0] || null;
}

async function listUsuarioAuditLogs({ limit = 100, offset = 0 } = {}) {
  const query = `
    SELECT
      a.id_auditoria,
      a.tipo_operacion,
      a.usuario_objetivo_id,
      objetivo.nombre_completo AS usuario_objetivo_nombre,
      objetivo.email AS usuario_objetivo_email,
      a.ejecutado_por_id,
      ejecutor.nombre_completo AS ejecutado_por_nombre,
      ejecutor.email AS ejecutado_por_email,
      a.detalle,
      a.created_at
    FROM auditoria_usuarios a
    LEFT JOIN usuarios objetivo ON objetivo.id_usuario = a.usuario_objetivo_id
    LEFT JOIN usuarios ejecutor ON ejecutor.id_usuario = a.ejecutado_por_id
    ORDER BY a.created_at DESC, a.id_auditoria DESC
    LIMIT $1 OFFSET $2
  `;
  const values = [limit, offset];
  const { rows } = await pool.query(query, values);
  return rows;
}

module.exports = {
  listUsuarios,
  getUsuarioById,
  createUsuario,
  updateUsuario,
  deleteUsuario,
  getUsuarioByEmail,
  updateUsuarioPassword,
  updateUsuarioRole,
  updateUsuarioProfile,
  deactivateUsuario,
  activateUsuario,
  insertUsuarioAuditLog,
  listUsuarioAuditLogs
};
