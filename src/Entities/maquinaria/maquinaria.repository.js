const pool = require('../../db/pool');

const baseSelect = `
  SELECT id_maquina, modelo_equipo, horometro_actual, estado, especificaciones, planes_mantencion_id_plan, tarifa_diaria, created_at, updated_at
  FROM maquinaria
`;

async function getHorasAcumuladasByMaquina(id_maquina) {
  const query = `
    SELECT
      m.id_maquina,
      m.modelo_equipo,
      m.estado,
      m.horometro_actual AS horas_acumuladas,
      m.especificaciones,
      m.created_at,
      m.updated_at,
      ultimo_historial.id_registro AS ultimo_registro_historial,
      ultimo_historial.valor_horas AS ultimo_valor_registrado,
      ultimo_historial.fecha_registro AS ultima_fecha_registro,
      COALESCE(conteo_historial.total_registros, 0) AS total_registros_historial
    FROM maquinaria m
    LEFT JOIN LATERAL (
      SELECT id_registro, valor_horas, fecha_registro
      FROM historial_horometro hh
      WHERE hh.maquinaria_id_maquina = m.id_maquina
      ORDER BY fecha_registro DESC, id_registro DESC
      LIMIT 1
    ) ultimo_historial ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::BIGINT AS total_registros
      FROM historial_horometro hh
      WHERE hh.maquinaria_id_maquina = m.id_maquina
    ) conteo_historial ON TRUE
    WHERE m.id_maquina = $1
  `;

  const { rows } = await pool.query(query, [id_maquina]);
  return rows[0] || null;
}

async function listMaquinaria() {
  const query = `
    SELECT 
      m.id_maquina, 
      m.modelo_equipo, 
      m.horometro_actual, 
      m.estado, 
      m.especificaciones, 
      m.planes_mantencion_id_plan, 
      m.tarifa_diaria,
      m.created_at, 
      m.updated_at,
      p.intervalo_horas,
      mo.operador_id AS operador_activo_id,
      uop.nombre_completo AS operador_activo_nombre,
      mo.fecha_inicio AS operador_activo_desde,
      CASE
        WHEN p.intervalo_horas IS NULL THEN 'Baja'
        WHEN (COALESCE(um.horometro_registro, uh.ultimo_valor_registrado, 0) + p.intervalo_horas - m.horometro_actual) <= 0 THEN 'Alta'
        WHEN (COALESCE(um.horometro_registro, uh.ultimo_valor_registrado, 0) + p.intervalo_horas - m.horometro_actual) <= (p.intervalo_horas * 0.3) THEN 'Media'
        ELSE 'Baja'
      END AS prioridad,
      
      CASE 
        WHEN p.intervalo_horas IS NULL OR p.intervalo_horas = 0 THEN 0
        ELSE ROUND(
          ((m.horometro_actual - COALESCE(um.horometro_registro, uh.ultimo_valor_registrado, 0)) / p.intervalo_horas) * 100
        , 2)
      END AS porcentaje_uso,
      
      (CURRENT_DATE - COALESCE(uh.ultima_fecha_registro, m.created_at::date)) AS dias_sin_registro
      
    FROM maquinaria m
    LEFT JOIN planes_mantencion p ON p.id_plan = m.planes_mantencion_id_plan
    LEFT JOIN LATERAL (
      SELECT mo.operador_id, mo.fecha_inicio
      FROM maquinaria_operadores mo
      WHERE mo.maquinaria_id_maquina = m.id_maquina
        AND mo.estado_asignacion = 'Activa'
      ORDER BY mo.fecha_inicio DESC, mo.id_asignacion DESC
      LIMIT 1
    ) mo ON TRUE
    LEFT JOIN usuarios uop ON uop.id_usuario = mo.operador_id
    LEFT JOIN LATERAL (
      SELECT horometro_registro 
      FROM mantenimiento 
      WHERE mantenimiento.maquinaria_id_maquina = m.id_maquina 
      ORDER BY fecha_servicio DESC, id_mantencion DESC 
      LIMIT 1
    ) um ON TRUE
    LEFT JOIN LATERAL (
      SELECT valor_horas AS ultimo_valor_registrado, fecha_registro AS ultima_fecha_registro
      FROM historial_horometro hh
      WHERE hh.maquinaria_id_maquina = m.id_maquina
      ORDER BY fecha_registro DESC, id_registro DESC
      LIMIT 1
    ) uh ON TRUE
    ORDER BY 
      CASE 
        WHEN (COALESCE(um.horometro_registro, uh.ultimo_valor_registrado, 0) + COALESCE(p.intervalo_horas, 0) - m.horometro_actual) <= 0 THEN 1
        WHEN (COALESCE(um.horometro_registro, uh.ultimo_valor_registrado, 0) + COALESCE(p.intervalo_horas, 0) - m.horometro_actual) <= (COALESCE(p.intervalo_horas, 0) * 0.3) THEN 2
        ELSE 3
      END ASC,
      m.id_maquina ASC
  `;
  const { rows } = await pool.query(query);
  return rows;
}

async function listMaquinasConMantenimientoUrgente(umbralHoras = 0, limit = null, offset = null) {
  const query = `
    SELECT
      m.id_maquina,
      m.modelo_equipo,
      m.horometro_actual,
      m.estado,
      p.intervalo_horas,
      COALESCE(um.horometro_registro, uh.ultimo_valor_registrado, 0) AS referencia_horometro,
      (COALESCE(um.horometro_registro, uh.ultimo_valor_registrado, 0) + COALESCE(p.intervalo_horas, 0) - m.horometro_actual) AS horas_restantes,
      CASE
        WHEN (COALESCE(um.horometro_registro, uh.ultimo_valor_registrado, 0) + COALESCE(p.intervalo_horas, 0) - m.horometro_actual) <= 0 THEN 'Alta'
        WHEN (COALESCE(um.horometro_registro, uh.ultimo_valor_registrado, 0) + COALESCE(p.intervalo_horas, 0) - m.horometro_actual) <= COALESCE(p.intervalo_horas, 0) * 0.3 THEN 'Media'
        ELSE 'Baja'
      END AS prioridad,
      
      CASE
        WHEN p.intervalo_horas IS NULL OR p.intervalo_horas = 0 THEN 0
        ELSE ROUND(
          ((m.horometro_actual - COALESCE(um.horometro_registro, uh.ultimo_valor_registrado, 0)) / p.intervalo_horas) * 100
        , 2)
      END AS porcentaje_uso
      
    FROM maquinaria m
    LEFT JOIN planes_mantencion p ON p.id_plan = m.planes_mantencion_id_plan
    LEFT JOIN LATERAL (
      SELECT horometro_registro
      FROM mantenimiento
      WHERE mantenimiento.maquinaria_id_maquina = m.id_maquina
      ORDER BY fecha_servicio DESC, id_mantencion DESC
      LIMIT 1
    ) um ON TRUE
    LEFT JOIN LATERAL (
      SELECT valor_horas AS ultimo_valor_registrado
      FROM historial_horometro hh
      WHERE hh.maquinaria_id_maquina = m.id_maquina
      ORDER BY fecha_registro DESC, id_registro DESC
      LIMIT 1
    ) uh ON TRUE
    WHERE p.intervalo_horas IS NOT NULL
      AND (COALESCE(um.horometro_registro, uh.ultimo_valor_registrado, 0) + COALESCE(p.intervalo_horas, 0) - m.horometro_actual) <= $1
    ORDER BY horas_restantes ASC
  `;
  const params = [umbralHoras];
  const { rows } = await pool.query(query, params);
  
  let result = rows;
  if (offset !== null) { result = result.slice(offset); }
  if (limit !== null) { result = result.slice(0, limit); }
  return result;
}

async function listIncidenciasByMaquina(maquinaria_id_maquina, solo_no_resueltas = false) {
  const query = `
    SELECT
      i.id_incidencia,
      i.fecha,
      i.descripcion,
      i.criticidad,
      i.vinculada_mantenimiento,
      i.mantenimiento_id,
      i.orden_trabajo_id,
      i.estado,
      i.operador_id,
      u.nombre_completo AS operador_nombre,
      ot.tipo_servicio AS orden_tipo_servicio,
      ot.estado_ot AS orden_estado_ot
    FROM incidencias_maquina i
    LEFT JOIN usuarios u ON u.id_usuario = i.operador_id
    LEFT JOIN ordenes_trabajo ot ON ot.id_orden = i.orden_trabajo_id
    WHERE i.maquinaria_id_maquina = $1
      ${solo_no_resueltas ? "AND i.estado = 'Pendiente'" : ''}
    ORDER BY i.fecha DESC, i.id_incidencia DESC
  `;

  const { rows } = await pool.query(query, [maquinaria_id_maquina]);
  return rows;
}

async function createIncidenciaForMaquina({ maquinaria_id_maquina, operador_id, fecha, descripcion, criticidad, vinculada_mantenimiento = false, mantenimiento_id = null, orden_trabajo_id = null }) {
  const query = `
    INSERT INTO incidencias_maquina (
      maquinaria_id_maquina,
      operador_id,
      fecha,
      descripcion,
      criticidad,
      vinculada_mantenimiento,
      mantenimiento_id,
      orden_trabajo_id,
      estado
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Pendiente')
    RETURNING id_incidencia, maquinaria_id_maquina, operador_id, fecha, descripcion, criticidad, vinculada_mantenimiento, mantenimiento_id, orden_trabajo_id, estado, created_at, updated_at
  `;

  const values = [
    maquinaria_id_maquina,
    operador_id,
    fecha || new Date(),
    descripcion,
    criticidad || 'Media',
    vinculada_mantenimiento,
    mantenimiento_id,
    orden_trabajo_id
  ];

  const { rows } = await pool.query(query, values);
  return rows[0];
}

async function getDisponibilidadMaquina(id_maquina, margenMinimoHoras = 50) {
  const query = `
    SELECT
      m.id_maquina,
      m.modelo_equipo,
      m.horometro_actual,
      m.estado,
      m.especificaciones,
      m.planes_mantencion_id_plan,
      m.tarifa_diaria,
      p.intervalo_horas,
      COALESCE(um.horometro_registro, uh.ultimo_valor_registrado, 0) AS referencia_horometro,
      (COALESCE(um.horometro_registro, uh.ultimo_valor_registrado, 0) + COALESCE(p.intervalo_horas, 0) - m.horometro_actual) AS horas_restantes,
      bloqueo.id_bloqueo AS bloqueo_activo_id,
      bloqueo.motivo_bloqueo AS bloqueo_activo_motivo,
      bloqueo.costo_estimado_reparacion AS bloqueo_activo_costo,
      bloqueo.estado_bloqueo AS bloqueo_activo_estado,
      CASE
        WHEN bloqueo.id_bloqueo IS NOT NULL THEN 'Bloqueada'
        ELSE m.estado
      END AS estado_disponibilidad,
      CASE
        WHEN m.estado <> 'Disponible' THEN FALSE
        WHEN bloqueo.id_bloqueo IS NOT NULL THEN FALSE
        WHEN p.intervalo_horas IS NULL THEN FALSE
        WHEN (COALESCE(um.horometro_registro, uh.ultimo_valor_registrado, 0) + COALESCE(p.intervalo_horas, 0) - m.horometro_actual) <= $2 THEN FALSE
        ELSE TRUE
      END AS puede_arrendar,
      CASE
        WHEN bloqueo.id_bloqueo IS NOT NULL THEN bloqueo.motivo_bloqueo
        WHEN m.estado <> 'Disponible' THEN 'La máquina no está en estado Disponible'
        WHEN p.intervalo_horas IS NULL THEN 'La máquina no tiene un plan de mantenimiento asignado'
        WHEN (COALESCE(um.horometro_registro, uh.ultimo_valor_registrado, 0) + COALESCE(p.intervalo_horas, 0) - m.horometro_actual) <= $2 THEN 'No cumple con el margen mínimo de horas antes del próximo mantenimiento'
        ELSE NULL
      END AS motivo_no_disponibilidad
    FROM maquinaria m
    LEFT JOIN planes_mantencion p ON p.id_plan = m.planes_mantencion_id_plan
    LEFT JOIN LATERAL (
      SELECT horometro_registro
      FROM mantenimiento
      WHERE mantenimiento.maquinaria_id_maquina = m.id_maquina
      ORDER BY fecha_servicio DESC, id_mantencion DESC
      LIMIT 1
    ) um ON TRUE
    LEFT JOIN LATERAL (
      SELECT valor_horas AS ultimo_valor_registrado
      FROM historial_horometro hh
      WHERE hh.maquinaria_id_maquina = m.id_maquina
      ORDER BY fecha_registro DESC, id_registro DESC
      LIMIT 1
    ) uh ON TRUE
    LEFT JOIN LATERAL (
      SELECT id_bloqueo, motivo_bloqueo, costo_estimado_reparacion, estado_bloqueo
      FROM bloqueos_criticos bc
      WHERE bc.maquinaria_id_maquina = m.id_maquina
        AND bc.estado_bloqueo = 'Activo'
      ORDER BY created_at DESC, id_bloqueo DESC
      LIMIT 1
    ) bloqueo ON TRUE
    WHERE m.id_maquina = $1
  `;

  const { rows } = await pool.query(query, [id_maquina, margenMinimoHoras]);
  return rows[0] || null;
}

async function getMaquinariaById(id_maquina) {
  const query = `${baseSelect} WHERE id_maquina = $1`;
  const { rows } = await pool.query(query, [id_maquina]);
  return rows[0] || null;
}

async function listMaquinasAsignadasByOperador(operador_id) {
  const query = `
    SELECT
      mo.id_asignacion,
      mo.maquinaria_id_maquina,
      m.modelo_equipo,
      m.horometro_actual,
      m.estado,
      m.especificaciones,
      m.tarifa_diaria,
      m.planes_mantencion_id_plan,
      p.nombre_plan,
      p.intervalo_horas,
      mo.operador_id,
      u.nombre_completo AS operador_nombre,
      u.email AS operador_email,
      mo.fecha_inicio,
      mo.fecha_fin,
      mo.estado_asignacion,
      mo.created_at,
      mo.updated_at
    FROM maquinaria_operadores mo
    INNER JOIN maquinaria m ON m.id_maquina = mo.maquinaria_id_maquina
    LEFT JOIN planes_mantencion p ON p.id_plan = m.planes_mantencion_id_plan
    INNER JOIN usuarios u ON u.id_usuario = mo.operador_id
    WHERE mo.operador_id = $1
      AND mo.estado_asignacion = 'Activa'
    ORDER BY mo.fecha_inicio DESC, mo.id_asignacion DESC
  `;

  const { rows } = await pool.query(query, [operador_id]);
  return rows;
}

async function getAsignacionActivaByMaquina(maquinaria_id_maquina) {
  const query = `
    SELECT
      mo.id_asignacion,
      mo.maquinaria_id_maquina,
      mo.operador_id,
      u.nombre_completo AS operador_nombre,
      u.email AS operador_email,
      mo.fecha_inicio,
      mo.fecha_fin,
      mo.estado_asignacion,
      mo.created_at,
      mo.updated_at
    FROM maquinaria_operadores mo
    INNER JOIN usuarios u ON u.id_usuario = mo.operador_id
    WHERE mo.maquinaria_id_maquina = $1
      AND mo.estado_asignacion = 'Activa'
    ORDER BY mo.fecha_inicio DESC, mo.id_asignacion DESC
    LIMIT 1
  `;

  const { rows } = await pool.query(query, [maquinaria_id_maquina]);
  return rows[0] || null;
}

async function asignarOperadorAMaquina({ maquinaria_id_maquina, operador_id, fecha_inicio = null, fecha_fin = null }, db = pool) {
  const useOwnTransaction = db === pool;
  const client = useOwnTransaction ? await pool.connect() : db;

  try {
    if (useOwnTransaction) {
      await client.query('BEGIN');
    }

    await client.query(
      `UPDATE maquinaria_operadores
       SET estado_asignacion = 'Finalizada',
           fecha_fin = COALESCE(fecha_fin, CURRENT_DATE),
           updated_at = NOW()
       WHERE maquinaria_id_maquina = $1
         AND estado_asignacion = 'Activa'`,
      [maquinaria_id_maquina]
    );

    const result = await client.query(
      `INSERT INTO maquinaria_operadores (
         maquinaria_id_maquina,
         operador_id,
         fecha_inicio,
         fecha_fin,
         estado_asignacion
       ) VALUES ($1, $2, COALESCE($3, CURRENT_DATE), $4, 'Activa')
       RETURNING id_asignacion, maquinaria_id_maquina, operador_id, fecha_inicio, fecha_fin, estado_asignacion, created_at, updated_at`,
      [maquinaria_id_maquina, operador_id, fecha_inicio, fecha_fin]
    );

    if (useOwnTransaction) {
      await client.query('COMMIT');
    }

    return result.rows[0] || null;
  } catch (error) {
    if (useOwnTransaction) {
      await client.query('ROLLBACK');
    }
    throw error;
  } finally {
    if (useOwnTransaction) {
      client.release();
    }
  }
}

async function finalizarAsignacionActivaByMaquina(maquinaria_id_maquina, fecha_fin = null, db = pool) {
  const query = `
    UPDATE maquinaria_operadores
    SET estado_asignacion = 'Finalizada',
        fecha_fin = COALESCE($2::date, fecha_fin, CURRENT_DATE),
        updated_at = NOW()
    WHERE maquinaria_id_maquina = $1
      AND estado_asignacion = 'Activa'
    RETURNING id_asignacion, maquinaria_id_maquina, operador_id, fecha_inicio, fecha_fin, estado_asignacion, created_at, updated_at
  `;

  const { rows } = await db.query(query, [maquinaria_id_maquina, fecha_fin]);
  return rows[0] || null;
}

async function createMaquinaria({ modelo_equipo, horometro_actual, estado, especificaciones, planes_mantencion_id_plan, tarifa_diaria }) {
  const query = `
    INSERT INTO maquinaria (modelo_equipo, horometro_actual, estado, especificaciones, planes_mantencion_id_plan, tarifa_diaria)
    VALUES ($1, $2, COALESCE($3, 'Disponible'), $4, $5, $6)
    RETURNING id_maquina, modelo_equipo, horometro_actual, estado, especificaciones, planes_mantencion_id_plan, tarifa_diaria, created_at, updated_at
  `;

  const values = [
    modelo_equipo,
    horometro_actual,
    estado || null,
    especificaciones || null,
    planes_mantencion_id_plan || null,
    tarifa_diaria ?? null
  ];

  const { rows } = await pool.query(query, values);
  return rows[0];
}

async function updateMaquinaria(id_maquina, { modelo_equipo, horometro_actual, estado, especificaciones, planes_mantencion_id_plan, tarifa_diaria }) {
  const current = await getMaquinariaById(id_maquina);
  if (!current) {
    return null;
  }

  const nextModelo = modelo_equipo === undefined ? current.modelo_equipo : modelo_equipo;
  const nextHorometro = horometro_actual === undefined ? current.horometro_actual : horometro_actual;
  const nextEstado = estado === undefined ? current.estado : estado;
  const nextEspecificaciones = especificaciones === undefined ? current.especificaciones : especificaciones;
  const nextPlan = planes_mantencion_id_plan === undefined ? current.planes_mantencion_id_plan : planes_mantencion_id_plan;
  const nextTarifa = tarifa_diaria === undefined ? current.tarifa_diaria : tarifa_diaria;

  const query = `
    UPDATE maquinaria
    SET modelo_equipo = $2,
        horometro_actual = $3,
        estado = $4,
        especificaciones = $5,
        planes_mantencion_id_plan = $6,
        tarifa_diaria = $7,
        updated_at = NOW()
    WHERE id_maquina = $1
    RETURNING id_maquina, modelo_equipo, horometro_actual, estado, especificaciones, planes_mantencion_id_plan, tarifa_diaria, created_at, updated_at
  `;

  const values = [
    id_maquina,
    nextModelo,
    nextHorometro,
    nextEstado,
    nextEspecificaciones ?? null,
    nextPlan ?? null,
    nextTarifa ?? null
  ];

  const { rows } = await pool.query(query, values);
  return rows[0] || null;
}

async function updateMaquinariaEstado(id_maquina, estado, db = pool) {
  const query = `
    UPDATE maquinaria
    SET estado = $2,
        updated_at = NOW()
    WHERE id_maquina = $1
    RETURNING id_maquina, modelo_equipo, horometro_actual, estado, especificaciones, planes_mantencion_id_plan, tarifa_diaria, created_at, updated_at
  `;

  const { rows } = await db.query(query, [id_maquina, estado]);
  return rows[0] || null;
}

async function markMaquinariaDisponibleSiArrendada(id_maquina, db = pool) {
  const query = `
    UPDATE maquinaria
    SET estado = 'Disponible',
        updated_at = NOW()
    WHERE id_maquina = $1
      AND estado = 'Arrendada'
    RETURNING id_maquina, modelo_equipo, horometro_actual, estado, especificaciones, planes_mantencion_id_plan, tarifa_diaria, created_at, updated_at
  `;

  const { rows } = await db.query(query, [id_maquina]);
  return rows[0] || null;
}

async function updateHorometroActual(id_maquina, horometro_actual) {
  const query = `
    UPDATE maquinaria
    SET horometro_actual = $2,
        updated_at = NOW()
    WHERE id_maquina = $1
    RETURNING id_maquina, modelo_equipo, horometro_actual, estado, especificaciones, planes_mantencion_id_plan, tarifa_diaria, created_at, updated_at
  `;

  const { rows } = await pool.query(query, [id_maquina, horometro_actual]);
  return rows[0] || null;
}

async function deleteMaquinaria(id_maquina) {
  const query = 'DELETE FROM maquinaria WHERE id_maquina = $1 RETURNING id_maquina';
  const { rowCount } = await pool.query(query, [id_maquina]);
  return rowCount > 0;
}

async function blockMaquinariaWithReason(id_maquina, motivo_bloqueo, costo_estimado_reparacion, estadoObjetivo = 'Bloqueada') {
  // Valida que la maquinaria exista
  const maquina = await getMaquinariaById(id_maquina);
  if (!maquina) {
    throw new Error('Maquinaria no encontrada');
  }

  const estadoNormalizado = String(estadoObjetivo || 'Bloqueada').trim();
  if (!['Bloqueada', 'No Operativa'].includes(estadoNormalizado)) {
    throw new Error('estadoObjetivo invalido para bloqueo crítico');
  }

  // Actualiza el estado crítico objetivo.
  await updateMaquinaria(id_maquina, {
    modelo_equipo: maquina.modelo_equipo,
    horometro_actual: maquina.horometro_actual,
    estado: estadoNormalizado,
    especificaciones: maquina.especificaciones,
    planes_mantencion_id_plan: maquina.planes_mantencion_id_plan,
    tarifa_diaria: maquina.tarifa_diaria
  });

  // Registra la razón del bloqueo
  const query = `
    INSERT INTO bloqueos_criticos (maquinaria_id_maquina, motivo_bloqueo, costo_estimado_reparacion, estado_bloqueo)
    VALUES ($1, $2, $3, 'Activo')
    ON CONFLICT (maquinaria_id_maquina) DO UPDATE
    SET motivo_bloqueo = $2,
        costo_estimado_reparacion = $3,
        estado_bloqueo = 'Activo',
        updated_at = NOW()
    RETURNING id_bloqueo, maquinaria_id_maquina, motivo_bloqueo, costo_estimado_reparacion, estado_bloqueo, created_at, updated_at
  `;

  const { rows } = await pool.query(query, [
    id_maquina,
    motivo_bloqueo,
    costo_estimado_reparacion || 0
  ]);

  return rows[0];
}

async function getBloqueoMaquinaria(id_maquina) {
  const query = `
    SELECT 
      id_bloqueo, 
      maquinaria_id_maquina, 
      motivo_bloqueo, 
      costo_estimado_reparacion, 
      estado_bloqueo, 
      created_at, 
      updated_at
    FROM bloqueos_criticos
    WHERE maquinaria_id_maquina = $1 AND estado_bloqueo = 'Activo'
  `;

  const { rows } = await pool.query(query, [id_maquina]);
  return rows[0] || null;
}

async function unblockMaquinaria(id_maquina) {
  // Valida que la maquinaria exista
  const maquina = await getMaquinariaById(id_maquina);
  if (!maquina) {
    throw new Error('Maquinaria no encontrada');
  }

  // Actualiza el estado a 'Disponible'
  const updated = await updateMaquinaria(id_maquina, {
    modelo_equipo: maquina.modelo_equipo,
    horometro_actual: maquina.horometro_actual,
    estado: 'Disponible',
    especificaciones: maquina.especificaciones,
    planes_mantencion_id_plan: maquina.planes_mantencion_id_plan,
    tarifa_diaria: maquina.tarifa_diaria
  });

  // Marca el bloqueo como resuelto
  const query = `
    UPDATE bloqueos_criticos
    SET estado_bloqueo = 'Resuelto',
        updated_at = NOW()
    WHERE maquinaria_id_maquina = $1 AND estado_bloqueo = 'Activo'
    RETURNING id_bloqueo, maquinaria_id_maquina, motivo_bloqueo, costo_estimado_reparacion, estado_bloqueo, created_at, updated_at
  `;

  const { rows } = await pool.query(query, [id_maquina]);
  return {
    maquinaria: updated,
    bloqueo_resuelto: rows[0] || null
  };
}

module.exports = {
  listMaquinaria,
  getMaquinariaById,
  getHorasAcumuladasByMaquina,
  listMaquinasAsignadasByOperador,
  getAsignacionActivaByMaquina,
  asignarOperadorAMaquina,
  finalizarAsignacionActivaByMaquina,
  createMaquinaria,
  updateMaquinaria,
  updateMaquinariaEstado,
  markMaquinariaDisponibleSiArrendada,
  updateHorometroActual,
  listMaquinasConMantenimientoUrgente,
  listIncidenciasByMaquina,
  createIncidenciaForMaquina,
  getDisponibilidadMaquina,
  deleteMaquinaria,
  blockMaquinariaWithReason,
  getBloqueoMaquinaria,
  unblockMaquinaria
};
