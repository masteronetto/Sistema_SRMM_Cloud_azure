import { requireDatabase } from '../../db/pool.js';

export async function listTiposServicio() {
  const result = await requireDatabase().query(`
    SELECT DISTINCT tipo_servicio
    FROM mantenimiento
    WHERE tipo_servicio IS NOT NULL AND TRIM(tipo_servicio) <> ''
    ORDER BY tipo_servicio ASC
  `);
  return result.rows;
}

export async function listHistorialMantencionesByMaquina(maquinariaId, filtros = {}) {
  const page = Number(filtros.page || 1);
  const perPage = Number(filtros.per_page || 10);
  const order = String(filtros.order || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const offset = Math.max(0, (page - 1) * perPage);
  const values = [];
  const wheres = [];
  let cursor = 2;

  values.push(Number(maquinariaId));
  wheres.push(`m.maquinaria_id_maquina = $1`);

  if (filtros.fecha_inicio) {
    values.push(filtros.fecha_inicio);
    wheres.push(`m.fecha_servicio >= $${cursor++}`);
  }

  if (filtros.fecha_fin) {
    values.push(filtros.fecha_fin);
    wheres.push(`m.fecha_servicio <= $${cursor++}`);
  }

  if (filtros.tipo_servicio) {
    values.push(`%${String(filtros.tipo_servicio).trim()}%`);
    wheres.push(`m.tipo_servicio ILIKE $${cursor++}`);
  }

  const whereClause = wheres.length ? `WHERE ${wheres.join(' AND ')}` : '';

  const countQuery = `
    SELECT COUNT(*)::int AS total
    FROM mantenimiento m
    ${whereClause}
  `;

  const countResult = await requireDatabase().query(countQuery, values);
  const total = countResult.rows[0]?.total ?? 0;

  const query = `
    SELECT
      m.id_mantencion AS id_registro,
      m.fecha_servicio AS fecha_registro,
      m.tipo_servicio,
      m.horometro_registro AS valor_horas,
      m.detalle_tecnico,
      m.usuarios_id_usuario AS id_usuario,
      m.maquinaria_id_maquina,
      mu.nombre AS usuario_nombre,
      maq.modelo_equipo,
      NULL::bigint AS arriendos_id_contrato
    FROM mantenimiento m
    LEFT JOIN identidad_usuario mu ON mu.oid = m.usuarios_id_usuario
    LEFT JOIN maquinaria maq ON maq.id = m.maquinaria_id_maquina
    ${whereClause}
    ORDER BY m.fecha_servicio ${order}, m.id_mantencion ${order}
    LIMIT $${cursor++} OFFSET $${cursor++}
  `;

  values.push(perPage);
  values.push(offset);

  const result = await requireDatabase().query(query, values);

  return {
    total,
    rows: result.rows
  };
}
