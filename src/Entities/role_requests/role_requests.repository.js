const pool = require('../../db/pool');

async function createRoleRequest({ usuario_id, nombre_usuario, email_usuario, mensaje }) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO role_requests (usuario_id, nombre_usuario, email_usuario, mensaje, estado, created_at)
       VALUES ($1, $2, $3, $4, 'Pendiente', NOW()) RETURNING *;`,
      [usuario_id, nombre_usuario, email_usuario, mensaje]
    );

    return result.rows[0];
  } finally {
    client.release();
  }
}

async function getPendingRoleRequestByUsuarioId(usuarioId) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT id_request, usuario_id, nombre_usuario, email_usuario, mensaje, estado, created_at
       FROM role_requests
       WHERE usuario_id = $1 AND estado = 'Pendiente'
       ORDER BY created_at DESC
       LIMIT 1;`,
      [usuarioId]
    );

    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

async function listRoleRequests({ limit = 50, offset = 0 } = {}) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT
         rr.id_request,
         rr.usuario_id,
         COALESCE(NULLIF(u.nombre_completo, ''), NULLIF(rr.nombre_usuario, '')) AS nombre_usuario,
         COALESCE(NULLIF(u.email, ''), rr.email_usuario) AS email_usuario,
         rr.mensaje,
         rr.estado,
         rr.created_at
       FROM role_requests rr
       LEFT JOIN usuarios u ON u.id_usuario = rr.usuario_id
       ORDER BY rr.created_at DESC
       LIMIT $1 OFFSET $2;`,
      [limit, offset]
    );

    return result.rows;
  } finally {
    client.release();
  }
}

async function deleteRoleRequest(idRequest) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'DELETE FROM role_requests WHERE id_request = $1 RETURNING id_request;',
      [idRequest]
    );

    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

async function updatePendingRoleRequestByUsuarioId(usuarioId, { nombre_usuario, email_usuario, mensaje }) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE role_requests
       SET nombre_usuario = $2,
           email_usuario = $3,
           mensaje = $4
       WHERE id_request = (
         SELECT id_request
         FROM role_requests
         WHERE usuario_id = $1
           AND estado = 'Pendiente'
         ORDER BY created_at DESC
         LIMIT 1
       )
       RETURNING id_request, usuario_id, nombre_usuario, email_usuario, mensaje, estado, created_at;`,
      [usuarioId, nombre_usuario, email_usuario, mensaje]
    );

    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

async function deleteRoleRequestsByUsuarioId(usuarioId) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'DELETE FROM role_requests WHERE usuario_id = $1 RETURNING id_request;',
      [usuarioId]
    );

    return result.rowCount || 0;
  } finally {
    client.release();
  }
}

module.exports = {
  createRoleRequest,
  getPendingRoleRequestByUsuarioId,
  updatePendingRoleRequestByUsuarioId,
  listRoleRequests,
  deleteRoleRequest,
  deleteRoleRequestsByUsuarioId,
};
