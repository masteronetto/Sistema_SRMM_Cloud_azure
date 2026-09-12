import { requireDatabase } from '../../db/pool.js';

export async function listEventos({ maquinariaIds = [] } = {}) {
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
    LEFT JOIN maquinaria m ON m.id = l.maquinaria_id_maquina
    LEFT JOIN arriendos a ON a.id_contrato = l.arriendos_id_contrato
    ${whereClause}
    ORDER BY l.created_at DESC, l.id_evento DESC
  `;

  const result = await requireDatabase().query(query, values);
  return result.rows;
}

export async function createEvento(input) {
  const result = await requireDatabase().query(`
    INSERT INTO logistica_eventos (
      maquinaria_id_maquina,
      arriendos_id_contrato,
      titulo,
      equipo,
      cliente,
      ruta,
      hora_evento,
      estado_evento
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id_evento, maquinaria_id_maquina, arriendos_id_contrato, titulo, equipo, cliente, ruta, hora_evento, estado_evento, created_at, updated_at
  `, [
    input.maquinaria_id_maquina ?? null,
    input.arriendos_id_contrato ?? null,
    input.titulo,
    input.equipo,
    input.cliente,
    input.ruta,
    input.hora_evento,
    input.estado_evento || 'Pendiente'
  ]);

  return result.rows[0] || null;
}

export async function getEventoById(id_evento) {
  const result = await requireDatabase().query(`
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
  `, [id_evento]);

  return result.rows[0] || null;
}

export async function updateEvento(id_evento, input) {
  const result = await requireDatabase().query(`
    UPDATE logistica_eventos
    SET maquinaria_id_maquina = $2,
        arriendos_id_contrato = $3,
        titulo = $4,
        equipo = $5,
        cliente = $6,
        ruta = $7,
        hora_evento = $8,
        estado_evento = $9,
        updated_at = NOW()
    WHERE id_evento = $1
    RETURNING id_evento, maquinaria_id_maquina, arriendos_id_contrato, titulo, equipo, cliente, ruta, hora_evento, estado_evento, created_at, updated_at
  `, [
    id_evento,
    input.maquinaria_id_maquina ?? null,
    input.arriendos_id_contrato ?? null,
    input.titulo,
    input.equipo,
    input.cliente,
    input.ruta,
    input.hora_evento,
    input.estado_evento || 'Pendiente'
  ]);

  return result.rows[0] || null;
}

export async function deleteEvento(id_evento) {
  const result = await requireDatabase().query(`
    DELETE FROM logistica_eventos
    WHERE id_evento = $1
    RETURNING id_evento
  `, [id_evento]);

  return result.rows[0] || null;
}

export async function getRetornoSimilar({ maquinaria_id_maquina = null, arriendos_id_contrato = null, titulo = '' } = {}) {
  const result = await requireDatabase().query(`
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
  `, [maquinaria_id_maquina, arriendos_id_contrato, titulo]);

  return result.rows[0] || null;
}
