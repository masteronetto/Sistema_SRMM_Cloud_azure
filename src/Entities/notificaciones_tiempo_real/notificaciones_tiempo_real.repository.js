const pool = require('../../db/pool');

/**
 * Crear una notificación en tiempo real para el administrador
 * Se dispara automáticamente cuando se genera una alerta crítica
 */
async function crearNotificacionTiempoReal(
  adminId,
  tipoNotificacion,
  maquinaId,
  nombreMaquina,
  prioridad,
  horasRestantes,
  detalles
) {
  const client = await pool.connect();
  try {
    const resultado = await client.query(
      `INSERT INTO notificaciones_tiempo_real 
       (admin_id, tipo_notificacion, maquina_id, nombre_maquina, prioridad, horas_restantes, detalles, leida, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       RETURNING *;`,
      [
        adminId,
        tipoNotificacion,
        maquinaId,
        nombreMaquina,
        prioridad,
        horasRestantes,
        JSON.stringify(detalles),
        false,
      ]
    );

    return resultado.rows[0];
  } finally {
    client.release();
  }
}

/**
 * Obtener todas las notificaciones del administrador
 * Ordenadas por más recientes primero, no leídas primero
 */
async function obtenerNotificacionesAdmin(adminId, opciones = {}) {
  const { solo_no_leidas = false, limite = 50, offset = 0 } = opciones;

  const client = await pool.connect();
  try {
    let query = `
      SELECT id_notificacion, admin_id, tipo_notificacion, maquina_id, nombre_maquina, 
             prioridad, horas_restantes, detalles, leida, created_at
      FROM notificaciones_tiempo_real
      WHERE admin_id = $1
    `;

    const valores = [adminId];
    let indiceParametro = 2;

    if (solo_no_leidas) {
      query += ` AND leida = false`;
    }

    query += ` ORDER BY leida ASC, created_at DESC LIMIT $${indiceParametro} OFFSET $${indiceParametro + 1}`;
    valores.push(limite, offset);

    const resultado = await client.query(query, valores);

    return resultado.rows.map((row) => ({
      ...row,
      detalles: typeof row.detalles === 'string' ? JSON.parse(row.detalles) : row.detalles,
    }));
  } finally {
    client.release();
  }
}

/**
 * Obtener cantidad de notificaciones no leídas del admin
 */
async function obtenerCountNotificacionesNoLeidas(adminId) {
  const client = await pool.connect();
  try {
    const resultado = await client.query(
      `SELECT COUNT(*) as count FROM notificaciones_tiempo_real 
       WHERE admin_id = $1 AND leida = false;`,
      [adminId]
    );

    return parseInt(resultado.rows[0].count, 10);
  } finally {
    client.release();
  }
}

/**
 * Marcar una notificación como leída
 */
async function marcarComoLeida(notificacionId, adminId) {
  const client = await pool.connect();
  try {
    const resultado = await client.query(
      `UPDATE notificaciones_tiempo_real 
       SET leida = true 
       WHERE id_notificacion = $1 AND admin_id = $2 
       RETURNING *;`,
      [notificacionId, adminId]
    );

    if (resultado.rows.length === 0) {
      return null;
    }

    const row = resultado.rows[0];
    return {
      ...row,
      detalles: typeof row.detalles === 'string' ? JSON.parse(row.detalles) : row.detalles,
    };
  } finally {
    client.release();
  }
}

/**
 * Marcar todas las notificaciones como leídas para un admin
 */
async function marcarTodasComoLeidas(adminId) {
  const client = await pool.connect();
  try {
    const resultado = await client.query(
      `UPDATE notificaciones_tiempo_real 
       SET leida = true 
       WHERE admin_id = $1 AND leida = false
       RETURNING id_notificacion;`,
      [adminId]
    );

    return resultado.rowCount;
  } finally {
    client.release();
  }
}

/**
 * Eliminar una notificación
 */
async function eliminarNotificacion(notificacionId, adminId) {
  const client = await pool.connect();
  try {
    const resultado = await client.query(
      `DELETE FROM notificaciones_tiempo_real 
       WHERE id_notificacion = $1 AND admin_id = $2 
       RETURNING id_notificacion;`,
      [notificacionId, adminId]
    );

    return resultado.rowCount > 0;
  } finally {
    client.release();
  }
}

/**
 * Obtener todas las notificaciones no leídas para enviarlas por WebSocket
 * (útil para reconexiones o sincronización)
 */
async function obtenerNotificacionesPendientesPorWebSocket(adminId) {
  const client = await pool.connect();
  try {
    const resultado = await client.query(
      `SELECT id_notificacion, tipo_notificacion, maquina_id, nombre_maquina, 
              prioridad, horas_restantes, detalles, created_at
       FROM notificaciones_tiempo_real
       WHERE admin_id = $1 AND leida = false
       ORDER BY created_at DESC
       LIMIT 100;`,
      [adminId]
    );

    return resultado.rows.map((row) => ({
      ...row,
      detalles: typeof row.detalles === 'string' ? JSON.parse(row.detalles) : row.detalles,
    }));
  } finally {
    client.release();
  }
}

module.exports = {
  crearNotificacionTiempoReal,
  obtenerNotificacionesAdmin,
  obtenerCountNotificacionesNoLeidas,
  marcarComoLeida,
  marcarTodasComoLeidas,
  eliminarNotificacion,
  obtenerNotificacionesPendientesPorWebSocket,
};
