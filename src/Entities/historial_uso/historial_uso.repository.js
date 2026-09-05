const pool = require('../../db/pool');

const baseSelect = `
  SELECT id_registro, valor_horas, fecha_registro, maquinaria_id_maquina, arriendos_id_contrato, id_usuario, created_at
  FROM historial_horometro
`;

async function getUltimoHistorialByMaquina(maquinaria_id_maquina) {
  const query = `${baseSelect} WHERE maquinaria_id_maquina = $1 ORDER BY fecha_registro DESC, id_registro DESC LIMIT 1`;
  const { rows } = await pool.query(query, [maquinaria_id_maquina]);
  return rows[0] || null;
}

async function getHistorialByMaquinaAndFecha(maquinaria_id_maquina, fecha_registro) {
  const query = `${baseSelect} WHERE maquinaria_id_maquina = $1 AND fecha_registro = $2 ORDER BY id_registro DESC LIMIT 1`;
  const { rows } = await pool.query(query, [maquinaria_id_maquina, fecha_registro]);
  return rows[0] || null;
}

async function createHistorialUso({ maquinaria_id_maquina, valor_horas, id_usuario, fecha_registro, arriendos_id_contrato }) {
  const query = `
    INSERT INTO historial_horometro (maquinaria_id_maquina, valor_horas, id_usuario, fecha_registro, arriendos_id_contrato)
    VALUES ($1, $2, $3, COALESCE($4, CURRENT_DATE), $5)
    RETURNING id_registro, valor_horas, fecha_registro, maquinaria_id_maquina, arriendos_id_contrato, id_usuario, created_at
  `;

  const values = [maquinaria_id_maquina, valor_horas, id_usuario, fecha_registro || null, arriendos_id_contrato || null];
  const { rows } = await pool.query(query, values);
  return rows[0];
}

async function listHistorialByMaquina(maquinaria_id_maquina) {
  const query = `${baseSelect} WHERE maquinaria_id_maquina = $1 ORDER BY fecha_registro ASC, id_registro ASC`;
  const { rows } = await pool.query(query, [maquinaria_id_maquina]);
  return rows;
}

async function listHistorialByMaquinaPaged({ maquinaria_id_maquina, page = 1, perPage = 10, order = 'desc', fecha_from = null, fecha_to = null, id_usuario = null }) {
  const offset = (page - 1) * perPage;
  const orderClause = order && order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  // Build dynamic WHERE clauses
  const whereParts = ['maquinaria_id_maquina = $1'];
  const values = [maquinaria_id_maquina];
  let idx = 2;

  if (fecha_from) {
    whereParts.push(`fecha_registro >= $${idx++}`);
    values.push(fecha_from);
  }
  if (fecha_to) {
    whereParts.push(`fecha_registro <= $${idx++}`);
    values.push(fecha_to);
  }
  if (id_usuario) {
    whereParts.push(`id_usuario = $${idx++}`);
    values.push(id_usuario);
  }

  const whereClause = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

  const dataQuery = `${baseSelect} ${whereClause} ORDER BY fecha_registro ${orderClause}, id_registro ${orderClause} LIMIT $${idx++} OFFSET $${idx++}`;
  values.push(perPage, offset);

  const countQuery = `SELECT COUNT(1) as total FROM historial_horometro ${whereClause}`;

  const [dataRes, countRes] = await Promise.all([
    pool.query(dataQuery, values),
    pool.query(countQuery, values.slice(0, values.length - 2))
  ]);

  return {
    rows: dataRes.rows,
    total: Number(countRes.rows[0].total)
  };
}

async function searchHistorial({ q = '', page = 1, perPage = 10, fecha_from = null, fecha_to = null, id_usuario = null }) {
  const offset = (page - 1) * perPage;

  const whereParts = [];
  const values = [];
  let idx = 1;

  if (q && q.trim() !== '') {
    // search in maquina modelo_equipo or descripcion
    whereParts.push(`(m.modelo_equipo ILIKE $${idx} OR m.descripcion ILIKE $${idx})`);
    values.push(`%${q.trim()}%`);
    idx++;
  }

  if (fecha_from) {
    whereParts.push(`h.fecha_registro >= $${idx++}`);
    values.push(fecha_from);
  }
  if (fecha_to) {
    whereParts.push(`h.fecha_registro <= $${idx++}`);
    values.push(fecha_to);
  }
  if (id_usuario) {
    whereParts.push(`h.id_usuario = $${idx++}`);
    values.push(id_usuario);
  }

  const whereClause = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

  const dataQuery = `
    SELECT h.id_registro, h.valor_horas, h.fecha_registro, h.maquinaria_id_maquina, h.arriendos_id_contrato, h.id_usuario, h.created_at,
           m.modelo_equipo
    FROM historial_horometro h
    LEFT JOIN maquinaria m ON m.id_maquina = h.maquinaria_id_maquina
    ${whereClause}
    ORDER BY h.fecha_registro DESC, h.id_registro DESC
    LIMIT $${idx++} OFFSET $${idx++}
  `;
  values.push(perPage, offset);

  const countQuery = `SELECT COUNT(1) as total FROM historial_horometro h LEFT JOIN maquinaria m ON m.id_maquina = h.maquinaria_id_maquina ${whereClause}`;

  const [dataRes, countRes] = await Promise.all([
    pool.query(dataQuery, values),
    pool.query(countQuery, values.slice(0, values.length - 2))
  ]);

  return {
    rows: dataRes.rows,
    total: Number(countRes.rows[0].total)
  };
}

module.exports = {
  getUltimoHistorialByMaquina,
  getHistorialByMaquinaAndFecha,
  createHistorialUso,
  listHistorialByMaquina
};
