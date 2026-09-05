const pool = require('../../db/pool');

function computePorcentajeVinculadas(totalVinculadas, totalFallas) {
  const vinc = Number(totalVinculadas || 0);
  const tot = Number(totalFallas || 0);
  if (!tot || tot === 0) return 0;
  return Number(((vinc / tot) * 100).toFixed(2));
}

let incidenciasAuditColumnsPromise = null;

async function getIncidenciasAuditColumns() {
  if (!incidenciasAuditColumnsPromise) {
    incidenciasAuditColumnsPromise = pool
      .query(
        `
          SELECT column_name
          FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'incidencias_maquina'
            AND column_name IN ('created_at', 'updated_at')
        `
      )
      .then(({ rows }) => new Set(rows.map((row) => row.column_name)));
  }

  return incidenciasAuditColumnsPromise;
}

async function getHistorialUnificado(id_maquina, fecha_inicio, fecha_fin) {
  let query = `
    SELECT * FROM vista_historial_completo 
    WHERE maquinaria_id_maquina = $1
  `;
  const values = [id_maquina];
  let paramsCount = 1;

  if (fecha_inicio) {
    paramsCount++;
    query += ` AND fecha_evento >= $${paramsCount}`;
    values.push(fecha_inicio);
  }
  if (fecha_fin) {
    paramsCount++;
    query += ` AND fecha_evento <= $${paramsCount}`;
    values.push(fecha_fin);
  }

  query += ` ORDER BY fecha_evento DESC, horometro DESC`;

  const { rows } = await pool.query(query, values);
  return rows;
}

// Ranking de máquinas con mayor horómetro acumulado.
async function getTopMaquinas() {
  const query = `
    SELECT id_maquina, modelo_equipo, horometro_actual 
    FROM maquinaria 
    ORDER BY horometro_actual DESC 
    LIMIT 5
  `;
  const { rows } = await pool.query(query);
  return rows;
}

// Estadísticas comparativas de mantenciones y fallas por máquina.
async function getEstadisticas() {
  const query = `
    SELECT 
      m.id_maquina, 
      m.modelo_equipo, 
      m.horometro_actual,
      COUNT(DISTINCT man.id_mantencion) AS total_mantenciones,
      COUNT(DISTINCT inc.id_incidencia) AS total_fallas,
      CASE 
        WHEN COUNT(DISTINCT man.id_mantencion) = 0 THEN 0
        ELSE ROUND(m.horometro_actual / COUNT(DISTINCT man.id_mantencion), 2) 
      END as promedio_horas_entre_mantenciones
    FROM maquinaria m
    LEFT JOIN mantenimiento man ON m.id_maquina = man.maquinaria_id_maquina
    LEFT JOIN incidencias_maquina inc ON m.id_maquina = inc.maquinaria_id_maquina
    GROUP BY m.id_maquina, m.modelo_equipo, m.horometro_actual
    ORDER BY total_fallas DESC, total_mantenciones DESC
  `;
  const { rows } = await pool.query(query);
  return rows;
}

// Serie histórica de horómetro para graficar la evolución de uso.
async function getUsoHistorico(id_maquina) {
  const query = `
    SELECT fecha_registro, valor_horas 
    FROM historial_horometro 
    WHERE maquinaria_id_maquina = $1 
    ORDER BY fecha_registro ASC
  `;
  const { rows } = await pool.query(query, [id_maquina]);
  return rows;
}

async function getResumenOperador(id_usuario) {
  const query = `
    SELECT
      COALESCE((SELECT COUNT(*)::int FROM maquinaria_operadores mo WHERE mo.operador_id = $1), 0) AS total_asignaciones,
      COALESCE((SELECT COUNT(*)::int FROM maquinaria_operadores mo WHERE mo.operador_id = $1 AND mo.estado_asignacion = 'Activa'), 0) AS asignaciones_activas,
      COALESCE((SELECT COUNT(DISTINCT mo.maquinaria_id_maquina)::int FROM maquinaria_operadores mo WHERE mo.operador_id = $1), 0) AS maquinas_asignadas,
      COALESCE((SELECT SUM(h.valor_horas)::numeric FROM historial_horometro h WHERE h.id_usuario = $1), 0) AS horas_registradas,
      COALESCE((SELECT COUNT(*)::int FROM incidencias_maquina i WHERE i.operador_id = $1), 0) AS incidencias_registradas,
      (
        SELECT json_build_object(
          'id_asignacion', mo.id_asignacion,
          'maquinaria_id_maquina', mo.maquinaria_id_maquina,
          'modelo_equipo', m.modelo_equipo,
          'estado_asignacion', mo.estado_asignacion,
          'fecha_inicio', mo.fecha_inicio,
          'fecha_fin', mo.fecha_fin
        )
        FROM maquinaria_operadores mo
        INNER JOIN maquinaria m ON m.id_maquina = mo.maquinaria_id_maquina
        WHERE mo.operador_id = $1
          AND mo.estado_asignacion = 'Activa'
        ORDER BY mo.fecha_inicio DESC, mo.id_asignacion DESC
        LIMIT 1
      ) AS asignacion_activa,
      (
        SELECT json_build_object(
          'id_contrato', a.id_contrato,
          'maquinaria_id_maquina', a.maquinaria_id_maquina,
          'modelo_equipo', m.modelo_equipo,
          'estado_contrato', a.estado_contrato,
          'fecha_inicio', a.fecha_inicio,
          'fecha_fin', a.fecha_fin
        )
        FROM arriendos a
        INNER JOIN maquinaria m ON m.id_maquina = a.maquinaria_id_maquina
        WHERE a.cliente_id = $1
          AND a.estado_contrato = 'Activo'
        ORDER BY a.fecha_inicio DESC, a.id_contrato DESC
        LIMIT 1
      ) AS contrato_activo
  `;

  const { rows } = await pool.query(query, [id_usuario]);
  const row = rows[0] || {};

  return {
    total_asignaciones: Number(row.total_asignaciones || 0),
    asignaciones_activas: Number(row.asignaciones_activas || 0),
    maquinas_asignadas: Number(row.maquinas_asignadas || 0),
    horas_registradas: Number(row.horas_registradas || 0),
    incidencias_registradas: Number(row.incidencias_registradas || 0),
    asignacion_activa: row.asignacion_activa || null,
    contrato_activo: row.contrato_activo || null
  };
}

async function getActividadPorAutor({ fecha_inicio = null, fecha_fin = null } = {}) {
  const conditions = [];
  const values = [];
  let idx = 1;

  if (fecha_inicio) {
    conditions.push(`fecha_evento >= $${idx}`);
    values.push(fecha_inicio);
    idx += 1;
  }

  if (fecha_fin) {
    conditions.push(`fecha_evento <= $${idx}`);
    values.push(fecha_fin);
    idx += 1;
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const query = `
    WITH actividad AS (
      SELECT
        u.id_usuario AS autor_id,
        u.nombre_completo AS autor_nombre,
        u.rol_acceso AS autor_rol,
        'Historial' AS tipo_actividad,
        h.fecha_registro::date AS fecha_evento,
        h.maquinaria_id_maquina,
        m.modelo_equipo,
        h.valor_horas::numeric AS valor_horas
      FROM historial_horometro h
      INNER JOIN usuarios u ON u.id_usuario = h.id_usuario
      INNER JOIN maquinaria m ON m.id_maquina = h.maquinaria_id_maquina
      UNION ALL
      SELECT
        u.id_usuario AS autor_id,
        u.nombre_completo AS autor_nombre,
        u.rol_acceso AS autor_rol,
        'Incidencia' AS tipo_actividad,
        i.fecha::date AS fecha_evento,
        i.maquinaria_id_maquina,
        m.modelo_equipo,
        NULL::numeric AS valor_horas
      FROM incidencias_maquina i
      INNER JOIN usuarios u ON u.id_usuario = i.operador_id
      INNER JOIN maquinaria m ON m.id_maquina = i.maquinaria_id_maquina
    )
    SELECT
      autor_id,
      autor_nombre,
      autor_rol,
      COUNT(*) FILTER (WHERE tipo_actividad = 'Historial')::int AS total_registros_horometro,
      COUNT(*) FILTER (WHERE tipo_actividad = 'Incidencia')::int AS total_incidencias,
      COUNT(DISTINCT maquinaria_id_maquina)::int AS maquinas_distintas,
      COALESCE(SUM(valor_horas), 0)::numeric AS horas_registradas,
      MAX(fecha_evento) AS ultimo_evento
    FROM actividad
    ${whereClause}
    GROUP BY autor_id, autor_nombre, autor_rol
    ORDER BY ultimo_evento DESC NULLS LAST, autor_nombre ASC
  `;

  const { rows } = await pool.query(query, values);

  return rows.map((row) => ({
    autor_id: Number(row.autor_id),
    autor_nombre: row.autor_nombre,
    autor_rol: row.autor_rol,
    total_registros_horometro: Number(row.total_registros_horometro || 0),
    total_incidencias: Number(row.total_incidencias || 0),
    maquinas_distintas: Number(row.maquinas_distintas || 0),
    horas_registradas: Number(row.horas_registradas || 0),
    ultimo_evento: row.ultimo_evento
  }));
}

function buildReporteFallasFilters({ maquinaria_ids = [], fecha_inicio = null, fecha_fin = null, criticidad = null, operador_id = null } = {}) {
  const conditions = [];
  const values = [];
  let paramIndex = 0;

  if (Array.isArray(maquinaria_ids) && maquinaria_ids.length > 0) {
    paramIndex += 1;
    conditions.push(`i.maquinaria_id_maquina = ANY($${paramIndex}::bigint[])`);
    values.push(maquinaria_ids.map((item) => Number(item)).filter((item) => Number.isFinite(item)));
  }

  if (fecha_inicio) {
    paramIndex += 1;
    conditions.push(`i.fecha >= $${paramIndex}`);
    values.push(fecha_inicio);
  }

  if (fecha_fin) {
    paramIndex += 1;
    conditions.push(`i.fecha <= $${paramIndex}`);
    values.push(fecha_fin);
  }

  if (criticidad) {
    paramIndex += 1;
    conditions.push(`i.criticidad = $${paramIndex}`);
    values.push(criticidad);
  }

  if (operador_id !== null && operador_id !== undefined) {
    paramIndex += 1;
    conditions.push(`i.operador_id = $${paramIndex}`);
    values.push(Number(operador_id));
  }

  return {
    whereClause: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    values
  };
}

function getReporteFallasPeriodoExpr(periodo = 'mensual') {
  const normalized = String(periodo || 'mensual').toLowerCase();

  if (normalized === 'semanal') {
    return `date_trunc('week', i.fecha)::date`;
  }

  if (normalized === 'trimestral') {
    return `date_trunc('quarter', i.fecha)::date`;
  }

  if (normalized === 'personalizado') {
    return `i.fecha::date`;
  }

  return `date_trunc('month', i.fecha)::date`;
}

async function getReporteFallas(filtros = {}) {
  const {
    periodo = 'mensual',
    maquinaria_ids = [],
    fecha_inicio = null,
    fecha_fin = null,
    criticidad = null,
    mostrar_advertencia = false,
    operador_id = null
  } = filtros;

  const { whereClause, values } = buildReporteFallasFilters({ maquinaria_ids, fecha_inicio, fecha_fin, criticidad, operador_id });
  const periodoExpr = getReporteFallasPeriodoExpr(periodo);
  const incidenciasAuditColumns = await getIncidenciasAuditColumns();
  const puedeCalcularResolucion = incidenciasAuditColumns.has('created_at') && incidenciasAuditColumns.has('updated_at');
  const promedioResolucionExpr = puedeCalcularResolucion
    ? `ROUND(COALESCE(AVG(CASE WHEN i.estado = 'Resuelta' THEN EXTRACT(EPOCH FROM (i.updated_at - i.created_at)) / 3600.0 END), 0)::numeric, 2)`
    : `0::numeric`;

  const groupedQuery = `
    SELECT
      i.maquinaria_id_maquina,
      m.modelo_equipo,
      i.criticidad,
      ${periodoExpr} AS periodo_bucket,
      COUNT(*)::int AS total_fallas,
      COUNT(*) FILTER (WHERE i.estado = 'Resuelta')::int AS total_resueltas,
      COUNT(*) FILTER (WHERE i.estado = 'Pendiente')::int AS total_pendientes,
      COUNT(*) FILTER (WHERE COALESCE(i.vinculada_mantenimiento, FALSE))::int AS total_vinculadas,
      ${promedioResolucionExpr} AS promedio_resolucion_horas
    FROM incidencias_maquina i
    INNER JOIN maquinaria m ON m.id_maquina = i.maquinaria_id_maquina
    ${whereClause}
    GROUP BY 1, 2, 3, 4
    ORDER BY periodo_bucket DESC, total_fallas DESC, m.modelo_equipo ASC, i.criticidad ASC
  `;

  const summaryQuery = `
    SELECT
      COUNT(*)::int AS total_fallas,
      COUNT(*) FILTER (WHERE i.estado = 'Resuelta')::int AS total_resueltas,
      COUNT(*) FILTER (WHERE i.estado = 'Pendiente')::int AS total_pendientes,
      COUNT(*) FILTER (WHERE COALESCE(i.vinculada_mantenimiento, FALSE))::int AS total_vinculadas,
      ${promedioResolucionExpr} AS promedio_resolucion_horas
    FROM incidencias_maquina i
    ${whereClause}
  `;

  const [groupedResult, summaryResult] = await Promise.all([
    pool.query(groupedQuery, values),
    pool.query(summaryQuery, values)
  ]);

  const rows = groupedResult.rows.map((row) => ({
    maquinaria_id_maquina: Number(row.maquinaria_id_maquina),
    modelo_equipo: row.modelo_equipo,
    criticidad: row.criticidad,
    periodo_bucket: row.periodo_bucket,
    total_fallas: Number(row.total_fallas || 0),
    total_resueltas: Number(row.total_resueltas || 0),
    total_pendientes: Number(row.total_pendientes || 0),
    total_vinculadas: Number(row.total_vinculadas || 0),
    promedio_resolucion_horas: Number(row.promedio_resolucion_horas || 0)
  }));

  const totalFallas = Number(summaryResult.rows[0]?.total_fallas || 0);
  const totalResueltas = Number(summaryResult.rows[0]?.total_resueltas || 0);
  const totalPendientes = Number(summaryResult.rows[0]?.total_pendientes || 0);
  const promedioResolucionHoras = Number(summaryResult.rows[0]?.promedio_resolucion_horas || 0);

  const porCriticidadMap = new Map();
  const porMaquinaMap = new Map();
  const porPeriodoMap = new Map();

  rows.forEach((row) => {
    porCriticidadMap.set(row.criticidad, (porCriticidadMap.get(row.criticidad) || 0) + row.total_fallas);
    porMaquinaMap.set(row.maquinaria_id_maquina, {
      maquinaria_id_maquina: row.maquinaria_id_maquina,
      modelo_equipo: row.modelo_equipo,
      total_fallas: (porMaquinaMap.get(row.maquinaria_id_maquina)?.total_fallas || 0) + row.total_fallas
    });
    const periodKey = row.periodo_bucket ? String(row.periodo_bucket).slice(0, 10) : 'Sin periodo';
    porPeriodoMap.set(periodKey, (porPeriodoMap.get(periodKey) || 0) + row.total_fallas);
  });

  const maquinaConMasFallas = Array.from(porMaquinaMap.values()).sort((a, b) => b.total_fallas - a.total_fallas)[0] || null;

  return {
    filtros: {
      periodo,
      maquinaria_ids: Array.isArray(maquinaria_ids) ? maquinaria_ids.map((item) => Number(item)).filter((item) => Number.isFinite(item)) : [],
      fecha_inicio,
      fecha_fin,
      criticidad,
      operador_id: operador_id !== null && operador_id !== undefined ? Number(operador_id) : null
    },
    resumen: {
      total_fallas: totalFallas,
      total_resueltas: totalResueltas,
      total_pendientes: totalPendientes,
      total_vinculadas: Number(summaryResult.rows[0]?.total_vinculadas || 0),
      porcentaje_vinculadas: computePorcentajeVinculadas(Number(summaryResult.rows[0]?.total_vinculadas || 0), Number(summaryResult.rows[0]?.total_fallas || 0)),
      promedio_resolucion_horas: promedioResolucionHoras,
      maquina_con_mas_fallas: maquinaConMasFallas,
      por_criticidad: Array.from(porCriticidadMap.entries()).map(([label, total]) => ({ label, total })).sort((a, b) => b.total - a.total),
      por_periodo: Array.from(porPeriodoMap.entries()).map(([label, total]) => ({ label, total })).sort((a, b) => new Date(b.label) - new Date(a.label))
    },
    agrupados: rows
  };
}

module.exports = {
  getHistorialUnificado,
  getTopMaquinas,
  getEstadisticas,
  getUsoHistorico,
  getResumenOperador,
  getActividadPorAutor,
  getReporteFallas,
  getReporteMantenimientos
};

module.exports.computePorcentajeVinculadas = computePorcentajeVinculadas;

async function getReporteMantenimientos() {
  const query = `
    SELECT
      m.id_maquina AS maquinaria_id_maquina,
      m.modelo_equipo,
      COUNT(*)::int AS total_mantenimientos,
      MAX(fecha_servicio) AS ultima_fecha_servicio,
      COUNT(*) FILTER (WHERE tipo_servicio IS NOT NULL)::int AS total_servicios_registrados
    FROM mantenimiento mt
    INNER JOIN maquinaria m ON m.id_maquina = mt.maquinaria_id_maquina
    GROUP BY m.id_maquina, m.modelo_equipo
    ORDER BY total_mantenimientos DESC, m.modelo_equipo ASC
  `;

  const { rows } = await pool.query(query);
  return rows.map((row) => ({
    maquinaria_id_maquina: Number(row.maquinaria_id_maquina),
    modelo_equipo: row.modelo_equipo,
    total_mantenimientos: Number(row.total_mantenimientos || 0),
    ultima_fecha_servicio: row.ultima_fecha_servicio,
    total_servicios_registrados: Number(row.total_servicios_registrados || 0)
  }));
}

// Ingresos por arriendos
async function getIngresosPorArriendos(fecha_inicio, fecha_fin, tarifa_diaria_fallback) {
  // fecha_inicio and fecha_fin are optional; tarifa_diaria_fallback is number (per day)
  const params = [];
  let where = '';
  let idx = 1;
  if (fecha_inicio) {
    where += ` AND a.fecha_inicio >= $${idx}`;
    params.push(fecha_inicio);
    idx++;
  }
  if (fecha_fin) {
    where += ` AND a.fecha_inicio <= $${idx}`;
    params.push(fecha_fin);
    idx++;
  }

  // always pass tarifa fallback as last param so we can COALESCE with m.tarifa_diaria
  params.push(tarifa_diaria_fallback || 0);
  const tarifaParamIdx = idx; // index of the tarifa fallback in the params array

  // dias = COALESCE(fecha_fin, CURRENT_DATE) - fecha_inicio
  const query = `
    SELECT
      a.maquinaria_id_maquina AS id_maquina,
      m.modelo_equipo,
      COUNT(*) AS contratos,
      SUM( (COALESCE(a.fecha_fin, CURRENT_DATE) - a.fecha_inicio) )::BIGINT AS dias_arrendados,
      COALESCE(m.tarifa_diaria, $${tarifaParamIdx})::NUMERIC(12,2) AS tarifa_usada,
      (SUM( (COALESCE(a.fecha_fin, CURRENT_DATE) - a.fecha_inicio) )::BIGINT * COALESCE(m.tarifa_diaria, $${tarifaParamIdx}) )::NUMERIC(14,2) AS ingresos
    FROM arriendos a
    LEFT JOIN maquinaria m ON m.id_maquina = a.maquinaria_id_maquina
    WHERE 1=1 ${where}
    GROUP BY a.maquinaria_id_maquina, m.modelo_equipo, m.tarifa_diaria
    ORDER BY dias_arrendados DESC
  `;

  const { rows } = await pool.query(query, params);

  // normalize numeric types
  const result = rows.map(r => ({
    id_maquina: r.id_maquina,
    modelo_equipo: r.modelo_equipo,
    contratos: Number(r.contratos || 0),
    dias_arrendados: Number(r.dias_arrendados || 0),
    tarifa_usada: Number(r.tarifa_usada || 0),
    ingresos: Number(r.ingresos || 0)
  }));

  const total = result.reduce((s, it) => s + (it.ingresos || 0), 0);

  return { by_maquina: result, total_ingresos: total };
}

module.exports.getIngresosPorArriendos = getIngresosPorArriendos;