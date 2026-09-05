const pool = require('../../db/pool');

async function listEventos({ maquinariaIds = [] } = {}) {
  const ids = Array.isArray(maquinariaIds)
    ? maquinariaIds.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0)
    : [];

  const values = [];
  let whereClause = '';
  if (ids.length) {
    values.push(ids);
    whereClause = 'WHERE l.maquinaria_id_maquina = ANY($1::bigint[])';
  }

  const query = `
    SELECT
      l.id_evento,
      l.arriendos_id_contrato,
      l.maquinaria_id_maquina,
      m.modelo_equipo AS maquinaria_modelo,
      a.estado_contrato AS arriendo_estado,
      l.titulo,
      l.equipo,
      l.cliente,
      l.ruta,
      l.hora_evento,
      l.estado_evento,
      l.created_at,
      l.updated_at
    FROM logistica_eventos l
    LEFT JOIN maquinaria m ON m.id_maquina = l.maquinaria_id_maquina
    LEFT JOIN arriendos a ON a.id_contrato = l.arriendos_id_contrato
    ${whereClause}
    ORDER BY l.created_at DESC, l.id_evento DESC
  `;

  const { rows } = await pool.query(query, values);
  return rows;
}

async function createEvento({ titulo, equipo, cliente, ruta, hora_evento, estado_evento = 'Pendiente', maquinaria_id_maquina = null, arriendos_id_contrato = null }) {
  const query = `
    INSERT INTO logistica_eventos (maquinaria_id_maquina, arriendos_id_contrato, titulo, equipo, cliente, ruta, hora_evento, estado_evento)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id_evento, maquinaria_id_maquina, arriendos_id_contrato, titulo, equipo, cliente, ruta, hora_evento, estado_evento, created_at, updated_at
  `;

  const { rows } = await pool.query(query, [maquinaria_id_maquina || null, arriendos_id_contrato || null, titulo, equipo, cliente, ruta, hora_evento, estado_evento]);
  return rows[0] || null;
}

async function deleteEvento(id_evento) {
  const query = 'DELETE FROM logistica_eventos WHERE id_evento = $1 RETURNING id_evento';
  const { rows } = await pool.query(query, [id_evento]);
  return rows[0] || null;
}

async function getEventoById(id_evento) {
  const query = `
    SELECT
      id_evento,
      maquinaria_id_maquina,
      arriendos_id_contrato,
      titulo,
      equipo,
      cliente,
      ruta,
      hora_evento,
      estado_evento,
      created_at,
      updated_at
    FROM logistica_eventos
    WHERE id_evento = $1
    LIMIT 1
  `;

  const { rows } = await pool.query(query, [id_evento]);
  return rows[0] || null;
}

async function updateEventoStatus(id_evento, estado_evento) {
  const query = `
    UPDATE logistica_eventos
    SET estado_evento = $2,
        updated_at = NOW()
    WHERE id_evento = $1
    RETURNING id_evento, maquinaria_id_maquina, arriendos_id_contrato, titulo, equipo, cliente, ruta, hora_evento, estado_evento, created_at, updated_at
  `;
  const { rows } = await pool.query(query, [id_evento, estado_evento]);
  return rows[0] || null;
}

async function getRetornoSimilar({ maquinaria_id_maquina = null, arriendos_id_contrato = null, titulo = '' } = {}) {
  const query = `
    SELECT
      id_evento,
      maquinaria_id_maquina,
      arriendos_id_contrato,
      titulo,
      equipo,
      cliente,
      ruta,
      hora_evento,
      estado_evento,
      created_at,
      updated_at
    FROM logistica_eventos
    WHERE maquinaria_id_maquina = $1
      AND COALESCE(arriendos_id_contrato, 0) = COALESCE($2, 0)
      AND titulo = $3
    ORDER BY id_evento DESC
    LIMIT 1
  `;

  const values = [maquinaria_id_maquina, arriendos_id_contrato, titulo];

  const { rows } = await pool.query(query, values);
  return rows[0] || null;
}

module.exports = {
  listEventos,
  createEvento,
  getEventoById,
  getRetornoSimilar,
  updateEventoStatus,
  deleteEvento
};