const pool = require('../../db/pool');

async function listArriendos(db = pool) {
  const query = `
    SELECT
      a.id_contrato,
      a.maquinaria_id_maquina,
      m.modelo_equipo,
      a.cliente_id,
      u.nombre_completo AS cliente_nombre,
      a.horometro_entrada,
      a.horometro_salida,
      a.fecha_inicio,
      a.fecha_fin,
      a.estado_contrato
    FROM arriendos a
    LEFT JOIN maquinaria m ON m.id_maquina = a.maquinaria_id_maquina
    LEFT JOIN usuarios u ON u.id_usuario = a.cliente_id
    ORDER BY a.id_contrato DESC
  `;

  const { rows } = await db.query(query);
  return rows;
}

async function createArriendo({ maquinaria_id_maquina, cliente_id = null, horometro_entrada = null, horometro_salida = null, fecha_inicio = null, fecha_fin = null, estado_contrato = 'Activo' }, db = pool) {
  const query = `
    INSERT INTO arriendos (
      maquinaria_id_maquina,
      cliente_id,
      horometro_entrada,
      horometro_salida,
      fecha_inicio,
      fecha_fin,
      estado_contrato
    ) VALUES ($1, $2, $3, $4, COALESCE($5, CURRENT_DATE), $6, COALESCE($7, 'Activo'))
    RETURNING id_contrato, maquinaria_id_maquina, cliente_id, horometro_entrada, horometro_salida, fecha_inicio, fecha_fin, estado_contrato
  `;

  const values = [
    maquinaria_id_maquina,
    cliente_id,
    horometro_entrada,
    horometro_salida,
    fecha_inicio,
    fecha_fin,
    estado_contrato
  ];

  const { rows } = await db.query(query, values);
  return rows[0] || null;
}

async function listArriendosByCliente(cliente_id, db = pool) {
  const query = `
    SELECT
      a.id_contrato,
      a.maquinaria_id_maquina,
      m.modelo_equipo,
      a.cliente_id,
      u.nombre_completo AS cliente_nombre,
      a.horometro_entrada,
      a.horometro_salida,
      a.fecha_inicio,
      a.fecha_fin,
      a.estado_contrato
    FROM arriendos a
    LEFT JOIN maquinaria m ON m.id_maquina = a.maquinaria_id_maquina
    LEFT JOIN usuarios u ON u.id_usuario = a.cliente_id
    WHERE a.cliente_id = $1
      AND a.estado_contrato = 'Activo'
    ORDER BY a.id_contrato DESC
  `;

  const { rows } = await db.query(query, [cliente_id]);
  return rows;
}

async function getArriendoById(id_contrato, db = pool) {
  const query = `
    SELECT
      a.id_contrato,
      a.maquinaria_id_maquina,
      a.cliente_id,
      a.estado_contrato,
      a.fecha_inicio,
      a.fecha_fin
    FROM arriendos a
    WHERE a.id_contrato = $1
    LIMIT 1
  `;

  const { rows } = await db.query(query, [id_contrato]);
  return rows[0] || null;
}

async function getArriendoActivoByMaquina(maquinaria_id_maquina, db = pool) {
  const query = `
    SELECT
      a.id_contrato,
      a.maquinaria_id_maquina,
      a.cliente_id,
      a.estado_contrato,
      a.fecha_inicio,
      a.fecha_fin
    FROM arriendos a
    WHERE a.maquinaria_id_maquina = $1
      AND a.estado_contrato = 'Activo'
    ORDER BY a.id_contrato DESC
    LIMIT 1
  `;

  const { rows } = await db.query(query, [maquinaria_id_maquina]);
  return rows[0] || null;
}

async function deleteArriendo(id_contrato, db = pool) {
  const query = 'DELETE FROM arriendos WHERE id_contrato = $1 RETURNING id_contrato';
  const { rows } = await db.query(query, [id_contrato]);
  return rows[0] || null;
}

async function markArriendoAsCompleted(id_contrato, db = pool) {
  const query = `
    UPDATE arriendos
    SET estado_contrato = 'Completado',
        fecha_fin = COALESCE(fecha_fin, CURRENT_DATE)
    WHERE id_contrato = $1
    RETURNING id_contrato, maquinaria_id_maquina, cliente_id, fecha_inicio, fecha_fin, estado_contrato
  `;

  const { rows } = await db.query(query, [id_contrato]);
  return rows[0] || null;
}

module.exports = {
  listArriendos,
  listArriendosByCliente,
  createArriendo,
  getArriendoById,
  getArriendoActivoByMaquina,
  markArriendoAsCompleted,
  deleteArriendo
};