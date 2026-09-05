const pool = require('../../db/pool');

async function createAlerta(maquinaria_id_maquina, tipo_alerta, porcentaje_umbral, horometro_critico) {
  const query = `
    INSERT INTO alertas_criticas (maquinaria_id_maquina, tipo_alerta, estado_alerta, porcentaje_umbral, horometro_critico, requiere_mantenimiento)
    VALUES ($1, $2, 'Pendiente', $3, $4, TRUE)
    RETURNING id_alerta, maquinaria_id_maquina, tipo_alerta, estado_alerta, porcentaje_umbral, horometro_critico, requiere_mantenimiento, created_at, updated_at
  `;

  const { rows } = await pool.query(query, [
    maquinaria_id_maquina,
    tipo_alerta,
    porcentaje_umbral,
    horometro_critico
  ]);

  return rows[0];
}

async function getAlertasPendientesByMaquina(maquinaria_id_maquina) {
  const query = `
    SELECT 
      id_alerta, 
      maquinaria_id_maquina, 
      tipo_alerta, 
      estado_alerta, 
      porcentaje_umbral, 
      horometro_critico, 
      requiere_mantenimiento, 
      created_at, 
      updated_at
    FROM alertas_criticas
    WHERE maquinaria_id_maquina = $1 AND estado_alerta = 'Pendiente'
    ORDER BY created_at DESC
  `;

  const { rows } = await pool.query(query, [maquinaria_id_maquina]);
  return rows;
}

async function getAlertaByCriticaByMaquina(maquinaria_id_maquina) {
  const query = `
    SELECT 
      id_alerta, 
      maquinaria_id_maquina, 
      tipo_alerta, 
      estado_alerta, 
      porcentaje_umbral, 
      horometro_critico, 
      requiere_mantenimiento, 
      created_at, 
      updated_at
    FROM alertas_criticas
    WHERE maquinaria_id_maquina = $1 AND tipo_alerta = 'Critica' AND estado_alerta = 'Pendiente'
    ORDER BY created_at DESC
    LIMIT 1
  `;

  const { rows } = await pool.query(query, [maquinaria_id_maquina]);
  return rows[0] || null;
}

async function getAllertasAll(limite = 50, offset = 0, estado = 'Pendiente') {
  const query = `
    SELECT 
      a.id_alerta,
      a.maquinaria_id_maquina,
      a.tipo_alerta,
      a.estado_alerta,
      a.porcentaje_umbral,
      a.horometro_critico,
      a.requiere_mantenimiento,
      a.created_at,
      a.updated_at,
      m.modelo_equipo,
      mo.operador_id AS operador_asignado_id,
      u.nombre_completo AS operador_asignado_nombre,
      ultimo.ultimo_registro_ts,
      (NOW() - ultimo.ultimo_registro_ts) AS tiempo_sin_registro
    FROM alertas_criticas a
    LEFT JOIN maquinaria m ON m.id_maquina = a.maquinaria_id_maquina
    LEFT JOIN LATERAL (
      SELECT mo.operador_id
      FROM maquinaria_operadores mo
      WHERE mo.maquinaria_id_maquina = a.maquinaria_id_maquina
        AND mo.estado_asignacion = 'Activa'
      ORDER BY mo.fecha_inicio DESC, mo.id_asignacion DESC
      LIMIT 1
    ) mo ON TRUE
    LEFT JOIN usuarios u ON u.id_usuario = mo.operador_id
    LEFT JOIN LATERAL (
      SELECT COALESCE(MAX(h.created_at), m.created_at) AS ultimo_registro_ts
      FROM historial_horometro h
      WHERE h.maquinaria_id_maquina = a.maquinaria_id_maquina
    ) ultimo ON TRUE
    WHERE ($3::text IS NULL OR a.estado_alerta = $3)
    ORDER BY a.created_at DESC
    LIMIT $1 OFFSET $2
  `;

  const estadoFiltro = estado && estado !== 'all' ? estado : null;
  const { rows } = await pool.query(query, [limite, offset, estadoFiltro]);
  return rows;
}

async function descartar(id_alerta) {
  const query = `
    UPDATE alertas_criticas
    SET estado_alerta = 'Descartada',
        updated_at = NOW()
    WHERE id_alerta = $1
    RETURNING id_alerta, maquinaria_id_maquina, tipo_alerta, estado_alerta, porcentaje_umbral, horometro_critico, requiere_mantenimiento, created_at, updated_at
  `;

  const { rows } = await pool.query(query, [id_alerta]);
  return rows[0] || null;
}

async function resolverAlerta(id_alerta) {
  const query = `
    UPDATE alertas_criticas
    SET estado_alerta = 'Resuelta',
        requiere_mantenimiento = FALSE,
        updated_at = NOW()
    WHERE id_alerta = $1
    RETURNING id_alerta, maquinaria_id_maquina, tipo_alerta, estado_alerta, porcentaje_umbral, horometro_critico, requiere_mantenimiento, created_at, updated_at
  `;

  const { rows } = await pool.query(query, [id_alerta]);
  return rows[0] || null;
}

async function verificarYGenerarAlertaCritica(maquinaria_id_maquina, horometro_actual, intervalo_horas, referencia_horometro) {
  /**
   * Verifica si se alcanzó el 100% del umbral de horas
   * Si es así, crea una alerta crítica y bloquea la máquina
   */
  if (!intervalo_horas || intervalo_horas <= 0) {
    return null; // Sin plan de mantenimiento, no se genera alerta
  }

  const horas_restantes = (referencia_horometro || 0) + intervalo_horas - horometro_actual;
  
  // Si las horas restantes son <= 0 (100% alcanzado)
  if (horas_restantes <= 0) {
    // Verificar si ya existe alerta crítica pendiente
    const alertaExistente = await getAlertaByCriticaByMaquina(maquinaria_id_maquina);
    
    if (!alertaExistente) {
      // Crear nueva alerta crítica
      const alerta = await createAlerta(
        maquinaria_id_maquina,
        'Critica',
        100,
        horometro_actual
      );
      return alerta;
    }
    
    return alertaExistente;
  }

  return null;
}

module.exports = {
  createAlerta,
  getAlertasPendientesByMaquina,
  getAlertaByCriticaByMaquina,
  getAllertasAll,
  descartar,
  resolverAlerta,
  verificarYGenerarAlertaCritica
};
