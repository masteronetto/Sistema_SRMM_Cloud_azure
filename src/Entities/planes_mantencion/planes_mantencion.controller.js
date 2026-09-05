const planesRepo = require('./planes_mantencion.repository');
const maquinariaRepo = require('../maquinaria/maquinaria.repository');
const alertasCriticasRepo = require('../alertas_criticas/alertas_criticas.repository');

function toPositiveNumber(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

/**
 * POST /api/planes-mantencion
 * Crear un nuevo plan de mantenimiento
 * Body: { nombre_plan, intervalo_horas, descripcion }
 */
async function crearPlan(req, res) {
  try {
    const { nombre_plan, intervalo_horas, descripcion } = req.body;

    // Validaciones
    if (!nombre_plan || typeof nombre_plan !== 'string' || nombre_plan.trim() === '') {
      return res.status(400).json({
        error: 'nombre_plan es requerido y debe ser un string',
      });
    }

    const intervaloNumerico = toPositiveNumber(intervalo_horas);
    if (intervaloNumerico === null) {
      return res.status(400).json({
        error: 'intervalo_horas es requerido y debe ser un número positivo',
      });
    }

    const plan = await planesRepo.crearPlan(
      nombre_plan.trim(),
      intervaloNumerico,
      descripcion && typeof descripcion === 'string' ? descripcion.trim() : null
    );

    return res.status(201).json({
      mensaje: 'Plan de mantenimiento creado exitosamente',
      plan,
    });
  } catch (error) {
    console.error('[planes-mantencion] Error creando plan:', error);
    return res.status(400).json({
      error: error.message || 'Error al crear el plan',
    });
  }
}

/**
 * GET /api/planes-mantencion
 * Obtener todos los planes de mantenimiento
 */
async function obtenerTodosLosPlanes(req, res) {
  try {
    const planes = await planesRepo.obtenerTodosLosPlanes();

    return res.status(200).json({
      cantidad: planes.length,
      planes,
    });
  } catch (error) {
    console.error('[planes-mantencion] Error listando planes:', error);
    return res.status(500).json({
      error: 'Error al obtener los planes',
      mensaje: error.message,
    });
  }
}

/**
 * GET /api/planes-mantencion/:id
 * Obtener un plan por ID
 */
async function obtenerPlanPorId(req, res) {
  try {
    const id_plan = toPositiveNumber(req.params.id);
    if (id_plan === null) {
      return res.status(400).json({
        error: 'ID debe ser un número positivo',
      });
    }

    const plan = await planesRepo.obtenerPlanPorId(id_plan);

    if (!plan) {
      return res.status(404).json({
        error: 'Plan no encontrado',
      });
    }

    // Obtener máquinas asignadas
    const maquinas = await planesRepo.obtenerMaquinasPorPlan(id_plan);

    return res.status(200).json({
      plan,
      cantidad_maquinas_asignadas: maquinas.length,
      maquinas,
    });
  } catch (error) {
    console.error('[planes-mantencion] Error obteniendo plan:', error);
    return res.status(500).json({
      error: 'Error al obtener el plan',
      mensaje: error.message,
    });
  }
}

/**
 * PUT /api/planes-mantencion/:id
 * Actualizar un plan
 * Body: { nombre_plan?, intervalo_horas?, descripcion? }
 */
async function actualizarPlan(req, res) {
  try {
    const id_plan = toPositiveNumber(req.params.id);
    if (id_plan === null) {
      return res.status(400).json({
        error: 'ID debe ser un número positivo',
      });
    }

    const planExistente = await planesRepo.obtenerPlanPorId(id_plan);
    if (!planExistente) {
      return res.status(404).json({
        error: 'Plan no encontrado',
      });
    }

    const { nombre_plan, intervalo_horas, descripcion } = req.body;

    // Validaciones opcionales
    if (nombre_plan !== undefined && (typeof nombre_plan !== 'string' || nombre_plan.trim() === '')) {
      return res.status(400).json({
        error: 'nombre_plan debe ser un string no vacío',
      });
    }

    if (intervalo_horas !== undefined) {
      const intervaloNumerico = toPositiveNumber(intervalo_horas);
      if (intervaloNumerico === null) {
        return res.status(400).json({
          error: 'intervalo_horas debe ser un número positivo',
        });
      }
    }

    const planActualizado = await planesRepo.actualizarPlan(
      id_plan,
      nombre_plan && typeof nombre_plan === 'string' ? nombre_plan.trim() : null,
      intervalo_horas ? toPositiveNumber(intervalo_horas) : null,
      descripcion && typeof descripcion === 'string' ? descripcion.trim() : null
    );

    if (!planActualizado) {
      return res.status(404).json({
        error: 'Plan no encontrado',
      });
    }

    return res.status(200).json({
      mensaje: 'Plan actualizado exitosamente',
      plan: planActualizado,
    });
  } catch (error) {
    console.error('[planes-mantencion] Error actualizando plan:', error);
    return res.status(400).json({
      error: error.message || 'Error al actualizar el plan',
    });
  }
}

/**
 * DELETE /api/planes-mantencion/:id
 * Eliminar un plan
 */
async function eliminarPlan(req, res) {
  try {
    const id_plan = toPositiveNumber(req.params.id);
    if (id_plan === null) {
      return res.status(400).json({
        error: 'ID debe ser un número positivo',
      });
    }

    // Verificar que no haya máquinas asignadas
    const maquinas = await planesRepo.obtenerMaquinasPorPlan(id_plan);
    if (maquinas.length > 0) {
      return res.status(409).json({
        error: 'No se puede eliminar el plan porque tiene máquinas asignadas',
        cantidad_maquinas: maquinas.length,
        maquinas,
      });
    }

    const planExistente = await planesRepo.obtenerPlanPorId(id_plan);
    if (!planExistente) {
      return res.status(404).json({
        error: 'Plan no encontrado',
      });
    }

    const eliminado = await planesRepo.eliminarPlan(id_plan);

    if (!eliminado) {
      return res.status(500).json({
        error: 'No se pudo eliminar el plan',
      });
    }

    return res.status(200).json({
      mensaje: 'Plan eliminado exitosamente',
      plan_id: id_plan,
    });
  } catch (error) {
    console.error('[planes-mantencion] Error eliminando plan:', error);
    return res.status(500).json({
      error: 'Error al eliminar el plan',
      mensaje: error.message,
    });
  }
}

/**
 * POST /api/planes-mantencion/:id/asignar-maquina/:maquina_id
 * Asignar un plan a una máquina
 */
async function asignarPlanAMaquina(req, res) {
  try {
    const id_plan = toPositiveNumber(req.params.id);
    const id_maquina = toPositiveNumber(req.params.maquina_id);

    if (id_plan === null || id_maquina === null) {
      return res.status(400).json({
        error: 'IDs deben ser números positivos',
      });
    }

    // Verificar que el plan existe
    const plan = await planesRepo.obtenerPlanPorId(id_plan);
    if (!plan) {
      return res.status(404).json({
        error: 'Plan no encontrado',
      });
    }

    const maquinaActualizada = await planesRepo.asignarPlanAMaquina(id_maquina, id_plan);

    const horometroActual = Number(maquinaActualizada?.horometro_actual ?? maquina.horometro_actual ?? 0);
    const intervaloHoras = Number(plan.intervalo_horas || 0);
    const horasRestantes = intervaloHoras - horometroActual;

    if (intervaloHoras > 0 && horasRestantes <= 0) {
      const motivoBloqueo = `Bloqueo automático por umbral de mantenimiento excedido al asignar plan (${horometroActual}h >= ${intervaloHoras}h).`;
      await maquinariaRepo.blockMaquinariaWithReason(id_maquina, motivoBloqueo, 0);
      await alertasCriticasRepo.verificarYGenerarAlertaCritica(id_maquina, horometroActual, intervaloHoras, 0);
    }

    const maquinaConEstadoFinal = await maquinariaRepo.getMaquinariaById(id_maquina);

    return res.status(200).json({
      mensaje: `Plan "${plan.nombre_plan}" asignado a la máquina`,
      maquina: maquinaConEstadoFinal || maquinaActualizada,
      plan_asignado: plan,
    });
  } catch (error) {
    console.error('[planes-mantencion] Error asignando plan:', error);
    return res.status(400).json({
      error: error.message || 'Error al asignar el plan',
    });
  }
}

/**
 * DELETE /api/planes-mantencion/:id/desasignar-maquina/:maquina_id
 * Desasignar un plan de una máquina
 */
async function desasignarPlanDeMaquina(req, res) {
  try {
    const id_maquina = toPositiveNumber(req.params.maquina_id);

    if (id_maquina === null) {
      return res.status(400).json({
        error: 'ID debe ser un número positivo',
      });
    }

    const maquina = await maquinariaRepo.getMaquinariaById(id_maquina);
    if (!maquina) {
      return res.status(404).json({
        error: 'Máquina no encontrada',
      });
    }

    if (!maquina.planes_mantencion_id_plan) {
      return res.status(409).json({
        error: 'La máquina no tiene un plan asignado',
      });
    }

    const maquinaActualizada = await planesRepo.asignarPlanAMaquina(id_maquina, null);

    return res.status(200).json({
      mensaje: 'Plan desasignado de la máquina',
      maquina: maquinaActualizada,
    });
  } catch (error) {
    console.error('[planes-mantencion] Error desasignando plan:', error);
    return res.status(400).json({
      error: error.message || 'Error al desasignar el plan',
    });
  }
}

/**
 * GET /api/planes-mantencion/maquina/:maquina_id
 * Obtener el plan asignado a una máquina
 */
async function obtenerPlanDeMaquina(req, res) {
  try {
    const id_maquina = toPositiveNumber(req.params.maquina_id);

    if (id_maquina === null) {
      return res.status(400).json({
        error: 'ID debe ser un número positivo',
      });
    }

    const maquina = await maquinariaRepo.getMaquinariaById(id_maquina);
    if (!maquina) {
      return res.status(404).json({
        error: 'Máquina no encontrada',
      });
    }

    const plan = await planesRepo.obtenerPlanDeMaquina(id_maquina);

    if (!plan) {
      return res.status(200).json({
        maquina,
        plan: null,
        mensaje: 'La máquina no tiene un plan de mantenimiento asignado',
      });
    }

    return res.status(200).json({
      maquina,
      plan,
    });
  } catch (error) {
    console.error('[planes-mantencion] Error obteniendo plan de maquina:', error);
    return res.status(500).json({
      error: 'Error al obtener el plan',
      mensaje: error.message,
    });
  }
}

module.exports = {
  crearPlan,
  obtenerTodosLosPlanes,
  obtenerPlanPorId,
  actualizarPlan,
  eliminarPlan,
  asignarPlanAMaquina,
  desasignarPlanDeMaquina,
  obtenerPlanDeMaquina,
};
