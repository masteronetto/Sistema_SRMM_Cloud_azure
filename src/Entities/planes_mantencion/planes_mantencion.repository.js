const pool = require('../../db/pool');

/**
 * Crear un nuevo plan de mantenimiento
 */
async function crearPlan(nombre_plan, intervalo_horas, descripcion) {
  const client = await pool.connect();
  try {
    const resultado = await client.query(
      `INSERT INTO planes_mantencion (nombre_plan, intervalo_horas, descripcion)
       VALUES ($1, $2, $3)
       RETURNING id_plan, nombre_plan, intervalo_horas, descripcion, created_at, updated_at;`,
      [nombre_plan, intervalo_horas, descripcion || null]
    );

    return resultado.rows[0];
  } catch (error) {
    if (error.code === '23505') {
      // Violación de constraint UNIQUE
      throw new Error(`El plan "${nombre_plan}" ya existe`);
    }
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Obtener todos los planes de mantenimiento
 */
async function obtenerTodosLosPlanes() {
  const client = await pool.connect();
  try {
    const resultado = await client.query(
      `SELECT id_plan, nombre_plan, intervalo_horas, descripcion, created_at, updated_at
       FROM planes_mantencion
       ORDER BY nombre_plan ASC;`
    );

    return resultado.rows;
  } finally {
    client.release();
  }
}

/**
 * Obtener un plan por ID
 */
async function obtenerPlanPorId(id_plan) {
  const client = await pool.connect();
  try {
    const resultado = await client.query(
      `SELECT id_plan, nombre_plan, intervalo_horas, descripcion, created_at, updated_at
       FROM planes_mantencion
       WHERE id_plan = $1;`,
      [id_plan]
    );

    return resultado.rows[0] || null;
  } finally {
    client.release();
  }
}

/**
 * Obtener un plan por nombre
 */
async function obtenerPlanPorNombre(nombre_plan) {
  const client = await pool.connect();
  try {
    const resultado = await client.query(
      `SELECT id_plan, nombre_plan, intervalo_horas, descripcion, created_at, updated_at
       FROM planes_mantencion
       WHERE nombre_plan = $1;`,
      [nombre_plan]
    );

    return resultado.rows[0] || null;
  } finally {
    client.release();
  }
}

/**
 * Actualizar un plan de mantenimiento
 */
async function actualizarPlan(id_plan, nombre_plan, intervalo_horas, descripcion) {
  const client = await pool.connect();
  try {
    const resultado = await client.query(
      `UPDATE planes_mantencion
       SET nombre_plan = COALESCE($2, nombre_plan),
           intervalo_horas = COALESCE($3, intervalo_horas),
           descripcion = COALESCE($4, descripcion),
           updated_at = NOW()
       WHERE id_plan = $1
       RETURNING id_plan, nombre_plan, intervalo_horas, descripcion, created_at, updated_at;`,
      [id_plan, nombre_plan || null, intervalo_horas || null, descripcion || null]
    );

    return resultado.rows[0] || null;
  } catch (error) {
    if (error.code === '23505') {
      throw new Error(`El nombre "${nombre_plan}" ya está en uso por otro plan`);
    }
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Eliminar un plan de mantenimiento
 */
async function eliminarPlan(id_plan) {
  const client = await pool.connect();
  try {
    const resultado = await client.query(
      `DELETE FROM planes_mantencion
       WHERE id_plan = $1
       RETURNING id_plan;`,
      [id_plan]
    );

    return resultado.rowCount > 0;
  } finally {
    client.release();
  }
}

/**
 * Obtener máquinas asignadas a un plan
 */
async function obtenerMaquinasPorPlan(id_plan) {
  const client = await pool.connect();
  try {
    const resultado = await client.query(
      `SELECT id_maquina, modelo_equipo, horometro_actual, estado, created_at, updated_at
       FROM maquinaria
       WHERE planes_mantencion_id_plan = $1
       ORDER BY modelo_equipo ASC;`,
      [id_plan]
    );

    return resultado.rows;
  } finally {
    client.release();
  }
}

/**
 * Asignar un plan a una máquina
 */
async function asignarPlanAMaquina(id_maquina, id_plan) {
  const client = await pool.connect();
  try {
    // Verificar que la máquina existe
    const maquinaRes = await client.query(
      `SELECT id_maquina FROM maquinaria WHERE id_maquina = $1;`,
      [id_maquina]
    );

    if (maquinaRes.rowCount === 0) {
      throw new Error('Máquina no encontrada');
    }

    // Verificar que el plan existe (si se proporciona)
    if (id_plan) {
      const planRes = await client.query(
        `SELECT id_plan FROM planes_mantencion WHERE id_plan = $1;`,
        [id_plan]
      );

      if (planRes.rowCount === 0) {
        throw new Error('Plan de mantenimiento no encontrado');
      }
    }

    // Asignar o desasignar el plan
    const resultado = await client.query(
      `UPDATE maquinaria
       SET planes_mantencion_id_plan = $2,
           updated_at = NOW()
       WHERE id_maquina = $1
       RETURNING id_maquina, modelo_equipo, planes_mantencion_id_plan, updated_at;`,
      [id_maquina, id_plan || null]
    );

    return resultado.rows[0];
  } finally {
    client.release();
  }
}

/**
 * Obtener el plan asignado a una máquina
 */
async function obtenerPlanDeMaquina(id_maquina) {
  const client = await pool.connect();
  try {
    const resultado = await client.query(
      `SELECT pm.id_plan, pm.nombre_plan, pm.intervalo_horas, pm.descripcion, pm.created_at, pm.updated_at
       FROM planes_mantencion pm
       JOIN maquinaria m ON m.planes_mantencion_id_plan = pm.id_plan
       WHERE m.id_maquina = $1;`,
      [id_maquina]
    );

    return resultado.rows[0] || null;
  } finally {
    client.release();
  }
}

module.exports = {
  crearPlan,
  obtenerTodosLosPlanes,
  obtenerPlanPorId,
  obtenerPlanPorNombre,
  actualizarPlan,
  eliminarPlan,
  obtenerMaquinasPorPlan,
  asignarPlanAMaquina,
  obtenerPlanDeMaquina,
};
