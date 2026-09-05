const pool = require('../../db/pool');

const baseSelect = `
  SELECT id_mantencion, tipo_servicio, horometro_registro, detalle_tecnico, fecha_servicio, maquinaria_id_maquina, usuarios_id_usuario, created_at
  FROM mantenimiento
`;

function buildHistorialMantencionesFilters(maquinaria_id_maquina, filtros = {}) {
  const {
    fecha_inicio = null,
    fecha_fin = null,
    tipo_servicio = null,
    order = 'desc'
  } = filtros;

  const conditions = ['m.maquinaria_id_maquina = $1'];
  const values = [maquinaria_id_maquina];
  let paramIndex = 1;

  if (fecha_inicio) {
    paramIndex += 1;
    conditions.push(`m.fecha_servicio >= $${paramIndex}`);
    values.push(fecha_inicio);
  }

  if (fecha_fin) {
    paramIndex += 1;
    conditions.push(`m.fecha_servicio <= $${paramIndex}`);
    values.push(fecha_fin);
  }

  if (tipo_servicio) {
    paramIndex += 1;
    conditions.push(`m.tipo_servicio ILIKE $${paramIndex}`);
    values.push(`%${tipo_servicio}%`);
  }

  const orderDirection = typeof order === 'string' && order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  return {
    whereClause: `WHERE ${conditions.join(' AND ')}`,
    values,
    orderDirection
  };
}

function buildHistorialMantencionesQuery(maquinaria_id_maquina, filtros = {}) {
  const {
    limit = null,
    offset = null
  } = filtros;

  const { whereClause, values, orderDirection } = buildHistorialMantencionesFilters(maquinaria_id_maquina, filtros);
  let query = `
    SELECT
      m.id_mantencion,
      m.tipo_servicio,
      m.horometro_registro,
      m.detalle_tecnico,
      m.fecha_servicio,
      m.maquinaria_id_maquina,
      m.usuarios_id_usuario,
      m.created_at,
      u.nombre_completo AS usuario_responsable,
      maq.modelo_equipo
    FROM mantenimiento m
    INNER JOIN usuarios u ON u.id_usuario = m.usuarios_id_usuario
    INNER JOIN maquinaria maq ON maq.id_maquina = m.maquinaria_id_maquina
    ${whereClause}
    ORDER BY m.fecha_servicio ${orderDirection}, m.id_mantencion ${orderDirection}
  `;

  let paramIndex = values.length;

  if (limit !== null) {
    paramIndex += 1;
    query += ` LIMIT $${paramIndex}`;
    values.push(limit);

    if (offset !== null) {
      paramIndex += 1;
      query += ` OFFSET $${paramIndex}`;
      values.push(offset);
    }
  } else if (offset !== null) {
    paramIndex += 1;
    query += ` OFFSET $${paramIndex}`;
    values.push(offset);
  }

  return { query, values, whereClause, orderDirection };
}

async function getMantenimientoById(id_mantencion) {
  const query = `${baseSelect} WHERE id_mantencion = $1`;
  const { rows } = await pool.query(query, [id_mantencion]);
  return rows[0] || null;
}

async function listMantenimientosByMaquina(maquinaria_id_maquina) {
  const query = `${baseSelect} WHERE maquinaria_id_maquina = $1 ORDER BY fecha_servicio DESC, id_mantencion DESC`;
  const { rows } = await pool.query(query, [maquinaria_id_maquina]);
  return rows;
}

async function listHistorialMantencionesByMaquina(maquinaria_id_maquina, filtros = {}) {
  const { query, values, whereClause, orderDirection } = buildHistorialMantencionesQuery(maquinaria_id_maquina, filtros);
  const countQuery = `
    SELECT COUNT(1) AS total
    FROM mantenimiento m
    INNER JOIN usuarios u ON u.id_usuario = m.usuarios_id_usuario
    INNER JOIN maquinaria maq ON maq.id_maquina = m.maquinaria_id_maquina
    ${whereClause}
  `;

  const countValues = values.slice(0, values.length - ((filtros.limit !== null && filtros.limit !== undefined) ? (filtros.offset !== null && filtros.offset !== undefined ? 2 : 1) : 0));

  const [dataResult, countResult] = await Promise.all([
    pool.query(query, values),
    pool.query(countQuery, countValues)
  ]);

  return {
    rows: dataResult.rows,
    total: Number(countResult.rows[0]?.total || 0)
  };
}

async function listTiposServicio() {
  const query = `
    SELECT DISTINCT tipo_servicio
    FROM mantenimiento
    WHERE tipo_servicio IS NOT NULL AND TRIM(tipo_servicio) <> ''
    ORDER BY tipo_servicio ASC
  `;

  const { rows } = await pool.query(query);
  return rows.map((row) => row.tipo_servicio);
}

async function createMantenimiento({ tipo_servicio, horometro_registro, detalle_tecnico, fecha_servicio, maquinaria_id_maquina, usuarios_id_usuario }) {
  const query = `
    INSERT INTO mantenimiento (
      tipo_servicio,
      horometro_registro,
      detalle_tecnico,
      fecha_servicio,
      maquinaria_id_maquina,
      usuarios_id_usuario
    ) VALUES ($1, $2, $3, COALESCE($4, CURRENT_DATE), $5, $6)
    RETURNING id_mantencion, tipo_servicio, horometro_registro, detalle_tecnico, fecha_servicio, maquinaria_id_maquina, usuarios_id_usuario, created_at
  `;

  const values = [
    tipo_servicio,
    horometro_registro,
    detalle_tecnico,
    fecha_servicio || null,
    maquinaria_id_maquina,
    usuarios_id_usuario
  ];

  const { rows } = await pool.query(query, values);
  return rows[0];
}

async function programarMantenimiento({ tipo_servicio, detalle_tecnico, fecha_programada, maquinaria_id_maquina, mecanico_asignado }) {
  const query = `
    INSERT INTO ordenes_trabajo (tipo_servicio, detalle_tecnico, fecha_programada, maquinaria_id_maquina, mecanico_asignado, estado_ot)
    VALUES ($1, $2, $3, $4, $5, 'Programada')
    RETURNING id_orden, tipo_servicio, detalle_tecnico, fecha_programada, maquinaria_id_maquina, mecanico_asignado, estado_ot, alerta_retraso_enviada, created_at, updated_at
  `;

  const { rows } = await pool.query(query, [
    tipo_servicio,
    detalle_tecnico,
    fecha_programada,
    maquinaria_id_maquina,
    mecanico_asignado
  ]);

  return rows[0];
}

async function getOrdenTrabajoById(id_orden) {
  const query = `
    SELECT
      ot.id_orden,
      ot.tipo_servicio,
      ot.detalle_tecnico,
      ot.fecha_programada,
      ot.maquinaria_id_maquina,
      ot.mecanico_asignado,
      ot.estado_ot,
      ot.alerta_retraso_enviada,
      ot.estado_maquina_al_bloquear,
      ot.created_at,
      ot.updated_at,
      maq.modelo_equipo,
      u.nombre_completo AS mecanico_nombre
    FROM ordenes_trabajo ot
    LEFT JOIN maquinaria maq ON maq.id_maquina = ot.maquinaria_id_maquina
    LEFT JOIN usuarios u ON u.id_usuario = ot.mecanico_asignado
    WHERE ot.id_orden = $1
  `;

  const { rows } = await pool.query(query, [id_orden]);
  return rows[0] || null;
}

async function listOrdenesByMaquina(maquinaria_id_maquina) {
  const query = `
    SELECT
      ot.id_orden,
      ot.tipo_servicio,
      ot.detalle_tecnico,
      ot.fecha_programada,
      ot.maquinaria_id_maquina,
      ot.mecanico_asignado,
      ot.estado_ot,
      ot.alerta_retraso_enviada,
      ot.estado_maquina_al_bloquear,
      ot.created_at,
      ot.updated_at,
      maq.modelo_equipo,
      u.nombre_completo AS mecanico_nombre
    FROM ordenes_trabajo ot
    LEFT JOIN maquinaria maq ON maq.id_maquina = ot.maquinaria_id_maquina
    LEFT JOIN usuarios u ON u.id_usuario = ot.mecanico_asignado
    WHERE ot.maquinaria_id_maquina = $1
    ORDER BY ot.fecha_programada DESC, ot.id_orden DESC
  `;

  const { rows } = await pool.query(query, [maquinaria_id_maquina]);
  return rows;
}

async function listOrdenesByMecanico(mecanico_asignado, estado = null) {
  let query = `
    SELECT id_orden, tipo_servicio, detalle_tecnico, fecha_programada, maquinaria_id_maquina, mecanico_asignado, estado_ot, alerta_retraso_enviada, estado_maquina_al_bloquear, created_at, updated_at
    FROM ordenes_trabajo
    WHERE mecanico_asignado = $1
  `;
  const params = [mecanico_asignado];

  if (estado) {
    query += ` AND estado_ot = $2`;
    params.push(estado);
  }

  query += ` ORDER BY fecha_programada DESC, id_orden DESC`;
  const { rows } = await pool.query(query, params);
  return rows;
}

async function listOrdenes({ limit = 10, offset = 0 } = {}) {
  const safeLimit = Number.isFinite(Number(limit)) && Number(limit) > 0 ? Number(limit) : 10;
  const safeOffset = Number.isFinite(Number(offset)) && Number(offset) >= 0 ? Number(offset) : 0;

  const dataQuery = `
    SELECT
      ot.id_orden,
      ot.tipo_servicio,
      ot.detalle_tecnico,
      ot.fecha_programada,
      ot.maquinaria_id_maquina,
      ot.mecanico_asignado,
      ot.estado_ot,
      ot.alerta_retraso_enviada,
      ot.estado_maquina_al_bloquear,
      ot.created_at,
      ot.updated_at,
      maq.modelo_equipo,
      u.nombre_completo AS mecanico_nombre
    FROM ordenes_trabajo ot
    INNER JOIN maquinaria maq ON maq.id_maquina = ot.maquinaria_id_maquina
    LEFT JOIN usuarios u ON u.id_usuario = ot.mecanico_asignado
    ORDER BY ot.fecha_programada DESC, ot.id_orden DESC
    LIMIT $1 OFFSET $2
  `;

  const countQuery = `SELECT COUNT(1) AS total FROM ordenes_trabajo`;

  const [dataResult, countResult] = await Promise.all([
    pool.query(dataQuery, [safeLimit, safeOffset]),
    pool.query(countQuery)
  ]);

  return {
    rows: dataResult.rows,
    total: Number(countResult.rows[0]?.total || 0),
  };
}

async function iniciarOrdenTrabajo(id_orden) {
  const query = `
    UPDATE ordenes_trabajo
    SET estado_ot = 'En Progreso',
        updated_at = NOW()
    WHERE id_orden = $1 AND estado_ot = 'Programada'
    RETURNING id_orden, tipo_servicio, detalle_tecnico, fecha_programada, maquinaria_id_maquina, mecanico_asignado, estado_ot, alerta_retraso_enviada, estado_maquina_al_bloquear, created_at, updated_at
  `;

  const { rows } = await pool.query(query, [id_orden]);
  return rows[0] || null;
}

async function completarOrdenTrabajo(id_orden, horometro_registro = null) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const ordenQuery = `
      SELECT
        ot.id_orden,
        ot.tipo_servicio,
        ot.detalle_tecnico,
        ot.fecha_programada,
        ot.maquinaria_id_maquina,
        ot.mecanico_asignado,
        ot.estado_ot,
        ot.alerta_retraso_enviada,
        ot.estado_maquina_al_bloquear,
        ot.created_at,
        ot.updated_at,
        maq.horometro_actual AS horometro_actual_maquina
      FROM ordenes_trabajo ot
      INNER JOIN maquinaria maq ON maq.id_maquina = ot.maquinaria_id_maquina
      WHERE ot.id_orden = $1
      FOR UPDATE
    `;

    const ordenResult = await client.query(ordenQuery, [id_orden]);
    const orden = ordenResult.rows[0] || null;
    if (!orden) {
      await client.query('ROLLBACK');
      return null;
    }

    if (!['Programada', 'En Progreso'].includes(orden.estado_ot)) {
      await client.query('ROLLBACK');
      return null;
    }

    const horometroActualMaquina = Number(orden.horometro_actual_maquina || 0);
    const horometroFinal = horometro_registro === null
      ? horometroActualMaquina
      : Number(horometro_registro);

    if (!Number.isFinite(horometroFinal) || horometroFinal < 0) {
      const invalidError = new Error('horometro_registro debe ser numérico y mayor o igual a 0');
      invalidError.code = 'INVALID_HOROMETRO';
      throw invalidError;
    }

    if (horometroFinal < horometroActualMaquina) {
      const invalidError = new Error('horometro_registro no puede ser menor al horometro_actual de la maquinaria');
      invalidError.code = 'INVALID_HOROMETRO';
      throw invalidError;
    }

    if (horometroFinal > horometroActualMaquina) {
      await client.query(
        `
          UPDATE maquinaria
          SET horometro_actual = $2,
              updated_at = NOW()
          WHERE id_maquina = $1
        `,
        [orden.maquinaria_id_maquina, horometroFinal]
      );
    }

    const mantenimientoResult = await client.query(
      `
        INSERT INTO mantenimiento (
          tipo_servicio,
          horometro_registro,
          detalle_tecnico,
          fecha_servicio,
          maquinaria_id_maquina,
          usuarios_id_usuario
        ) VALUES ($1, $2, $3, CURRENT_DATE, $4, $5)
        RETURNING id_mantencion
      `,
      [
        orden.tipo_servicio,
        horometroFinal,
        orden.detalle_tecnico,
        orden.maquinaria_id_maquina,
        orden.mecanico_asignado
      ]
    );

    const completeResult = await client.query(
      `
        UPDATE ordenes_trabajo
        SET estado_ot = 'Completada',
            alerta_retraso_enviada = FALSE,
            updated_at = NOW()
        WHERE id_orden = $1
          AND estado_ot IN ('Programada', 'En Progreso')
        RETURNING id_orden, tipo_servicio, detalle_tecnico, fecha_programada, maquinaria_id_maquina, mecanico_asignado, estado_ot, alerta_retraso_enviada, estado_maquina_al_bloquear, created_at, updated_at
      `,
      [id_orden]
    );

    const completedOrder = completeResult.rows[0] || null;
    if (!completedOrder) {
      await client.query('ROLLBACK');
      return null;
    }

    await client.query('COMMIT');

    return {
      ...completedOrder,
      id_mantencion_generada: mantenimientoResult.rows[0]?.id_mantencion || null,
      horometro_registro_aplicado: horometroFinal
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function cancelarOrdenTrabajo(id_orden) {
  const query = `
    UPDATE ordenes_trabajo
    SET estado_ot = 'Cancelada',
        updated_at = NOW()
    WHERE id_orden = $1
    RETURNING id_orden, tipo_servicio, detalle_tecnico, fecha_programada, maquinaria_id_maquina, mecanico_asignado, estado_ot, alerta_retraso_enviada, estado_maquina_al_bloquear, created_at, updated_at
  `;

  const { rows } = await pool.query(query, [id_orden]);
  return rows[0] || null;
}

async function deleteOrdenTrabajo(id_orden) {
  const query = `
    DELETE FROM ordenes_trabajo
    WHERE id_orden = $1
    RETURNING id_orden, tipo_servicio, detalle_tecnico, fecha_programada, maquinaria_id_maquina, mecanico_asignado, estado_ot, alerta_retraso_enviada, estado_maquina_al_bloquear, created_at, updated_at
  `;

  const { rows } = await pool.query(query, [id_orden]);
  return rows[0] || null;
}

async function listOrdenesAtrasadas() {
  const query = `
    SELECT
      ot.id_orden,
      ot.tipo_servicio,
      ot.detalle_tecnico,
      ot.fecha_programada,
      ot.maquinaria_id_maquina,
      ot.mecanico_asignado,
      ot.estado_ot,
      ot.alerta_retraso_enviada,
      ot.created_at,
      ot.updated_at,
      m.modelo_equipo,
      u.nombre_completo AS mecanico_nombre,
      (CURRENT_DATE - ot.fecha_programada) AS dias_atraso
    FROM ordenes_trabajo ot
    JOIN maquinaria m ON m.id_maquina = ot.maquinaria_id_maquina
    JOIN usuarios u ON u.id_usuario = ot.mecanico_asignado
    WHERE ot.fecha_programada < CURRENT_DATE
      AND ot.estado_ot IN ('Programada', 'En Progreso')
    ORDER BY ot.fecha_programada ASC, ot.id_orden ASC
  `;

  const { rows } = await pool.query(query);
  return rows;
}

async function marcarRetrasoNotificado(id_orden) {
  const query = `
    UPDATE ordenes_trabajo
    SET alerta_retraso_enviada = TRUE,
        updated_at = NOW()
    WHERE id_orden = $1
    RETURNING id_orden
  `;

  const { rows } = await pool.query(query, [id_orden]);
  return rows[0] || null;
}

module.exports = {
  getMantenimientoById,
  listMantenimientosByMaquina,
  listHistorialMantencionesByMaquina,
  listTiposServicio,
  createMantenimiento,
  programarMantenimiento,
  getOrdenTrabajoById,
  listOrdenesByMaquina,
  listOrdenes,
  listOrdenesByMecanico,
  listOrdenesAtrasadas,
  marcarRetrasoNotificado,
  iniciarOrdenTrabajo,
  completarOrdenTrabajo,
  cancelarOrdenTrabajo,
  deleteOrdenTrabajo
};
