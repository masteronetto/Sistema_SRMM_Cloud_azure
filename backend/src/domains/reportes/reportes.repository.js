import { requireDatabase } from '../../db/pool.js';

export async function listEstadisticas() {
  const result = await requireDatabase().query(`
    SELECT
      m.id,
      m.modelo_equipo,
      m.horometro_actual,
      COALESCE(COUNT(mt.id_mantencion), 0)::int AS total_mantenciones,
      COALESCE(COUNT(fi.id_incidencia), 0)::int AS total_fallas
    FROM maquinaria m
    LEFT JOIN mantenimiento mt ON mt.maquinaria_id_maquina = m.id
    LEFT JOIN incidencias_maquina fi ON fi.maquinaria_id_maquina = m.id
    GROUP BY m.id, m.modelo_equipo, m.horometro_actual
    ORDER BY m.id DESC
  `);
  return result.rows;
}

export async function listTopMaquinas() {
  const result = await requireDatabase().query(`
    SELECT
      m.id,
      m.modelo_equipo,
      m.horometro_actual,
      m.estado
    FROM maquinaria m
    ORDER BY m.horometro_actual DESC, m.id DESC
    LIMIT 10
  `);
  return result.rows;
}

export async function listAutores({ fecha_inicio, fecha_fin } = {}) {
  const result = await requireDatabase().query(`
    SELECT DISTINCT
      iu.oid,
      iu.nombre,
      iu.correo,
      iu.ultimo_acceso
    FROM identidad_usuario iu
    WHERE iu.ultimo_acceso BETWEEN COALESCE($1::timestamptz, '-infinity') AND COALESCE($2::timestamptz, 'infinity')
    ORDER BY iu.ultimo_acceso DESC NULLS LAST
  `, [fecha_inicio ? `${fecha_inicio}T00:00:00Z` : null, fecha_fin ? `${fecha_fin}T23:59:59Z` : null]);
  return result.rows;
}

export async function listUsoHistorico(idMaquina) {
  const result = await requireDatabase().query(`
    SELECT fecha_registro, valor_horas
    FROM historial_horometro
    WHERE maquinaria_id_maquina = $1
    ORDER BY fecha_registro ASC
  `, [Number(idMaquina)]);
  return result.rows;
}

export async function listIngresos({ fecha_inicio, fecha_fin } = {}) {
  const result = await requireDatabase().query(`
    SELECT
      m.id AS id_maquina,
      m.modelo_equipo,
      COUNT(a.id_contrato)::int AS contratos,
      COALESCE(COUNT(a.id_contrato) * m.tarifa_diaria, 0)::numeric(14,2) AS ingresos
    FROM maquinaria m
    LEFT JOIN arriendos a
      ON a.maquinaria_id_maquina = m.id
     AND a.fecha_inicio >= COALESCE($1::date, '1900-01-01')
     AND COALESCE(a.fecha_fin, CURRENT_DATE) <= COALESCE($2::date, CURRENT_DATE)
    GROUP BY m.id, m.modelo_equipo, m.tarifa_diaria
    ORDER BY m.id DESC
  `, [fecha_inicio || null, fecha_fin || null]);
  return result.rows;
}
