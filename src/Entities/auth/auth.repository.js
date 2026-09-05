const pool = require('../../db/pool');

async function createRecoveryAttempt({ email_solicitante, ip_solicitante, user_agent = null, estado_intento, detalle = null }) {
  const query = `
    INSERT INTO intentos_recuperacion (email_solicitante, ip_solicitante, user_agent, estado_intento, detalle)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id_intento, email_solicitante, ip_solicitante, user_agent, estado_intento, detalle, created_at
  `;
  const values = [
    String(email_solicitante || '').trim().toLowerCase(),
    String(ip_solicitante || '').trim(),
    user_agent ? String(user_agent) : null,
    String(estado_intento || '').trim(),
    detalle ? String(detalle) : null
  ];

  const { rows } = await pool.query(query, values);
  return rows[0] || null;
}

async function listRecoveryAttempts({ limit = 100, offset = 0 } = {}) {
  const query = `
    SELECT id_intento, email_solicitante, ip_solicitante, user_agent, estado_intento, detalle, created_at
    FROM intentos_recuperacion
    ORDER BY created_at DESC, id_intento DESC
    LIMIT $1 OFFSET $2
  `;

  const values = [limit, offset];
  const { rows } = await pool.query(query, values);
  return rows;
}

module.exports = {
  createRecoveryAttempt,
  listRecoveryAttempts
};
