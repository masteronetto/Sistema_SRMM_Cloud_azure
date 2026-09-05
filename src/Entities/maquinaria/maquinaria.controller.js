const pool = require('../../db/pool');
const maquinariaRepo = require('./maquinaria.repository');
const usuariosRepo = require('../usuarios/usuarios.repository');
const mantenimientosRepo = require('../mantenimientos/mantenimientos.repository');
const planesRepo = require('../planes_mantencion/planes_mantencion.repository');
const alertasCriticasRepo = require('../alertas_criticas/alertas_criticas.repository');

const estadosPermitidos = new Set(['Disponible', 'Arrendada', 'Mantencion', 'Bloqueada', 'No Operativa']);

function toNumberOrNull(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

function validatePayload(payload) {
  const { modelo_equipo } = payload;
  const horometro_actual = toNumberOrNull(payload.horometro_actual);
  const estado = payload.estado || 'Disponible';

  if (!modelo_equipo || horometro_actual === null) {
    return {
      error: 'Campos obligatorios: modelo_equipo, horometro_actual',
      parsed: null
    };
  }

  if (!estadosPermitidos.has(estado)) {
    return {
      error: 'estado invalido. Valores permitidos: Disponible, Arrendada, Mantencion, Bloqueada, No Operativa',
      parsed: null
    };
  }

  const planes_mantencion_id_plan = toNumberOrNull(payload.planes_mantencion_id_plan);
  if (payload.planes_mantencion_id_plan !== undefined && payload.planes_mantencion_id_plan !== null && planes_mantencion_id_plan === null) {
    return {
      error: 'planes_mantencion_id_plan debe ser numerico si se envia',
      parsed: null
    };
  }

  const tarifaDiariaRaw = payload.tarifa_diaria;
  const tarifa_diaria = tarifaDiariaRaw === undefined ? undefined : toNumberOrNull(tarifaDiariaRaw);
  if (tarifaDiariaRaw !== undefined && tarifaDiariaRaw !== null && tarifa_diaria === null) {
    return {
      error: 'tarifa_diaria debe ser numerico y no negativo si se envia',
      parsed: null
    };
  }

  return {
    error: null,
    parsed: {
      modelo_equipo,
      horometro_actual,
      estado,
      especificaciones: payload.especificaciones || null,
      planes_mantencion_id_plan,
      tarifa_diaria
    }
  };
}

async function list(req, res, next) {
  try {
    const data = await maquinariaRepo.listMaquinaria();
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

async function getById(req, res, next) {
  try {
    const id_maquina = toNumberOrNull(req.params.id_maquina);
    if (id_maquina === null) {
      return res.status(400).json({ message: 'id_maquina debe ser numerico y mayor o igual a 0' });
    }

    const data = await maquinariaRepo.getMaquinariaById(id_maquina);
    if (!data) {
      return res.status(404).json({ message: 'Maquinaria no encontrada' });
    }

    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

async function getHorasAcumuladas(req, res, next) {
  try {
    const id_maquina = toNumberOrNull(req.params.id_maquina);
    if (id_maquina === null) {
      return res.status(400).json({ message: 'id_maquina debe ser numerico y mayor o igual a 0' });
    }

    const data = await maquinariaRepo.getHorasAcumuladasByMaquina(id_maquina);
    if (!data) {
      return res.status(404).json({ message: 'Maquinaria no encontrada' });
    }

    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

async function getDisponibilidad(req, res, next) {
  try {
    const id_maquina = toNumberOrNull(req.params.id_maquina);
    if (id_maquina === null) {
      return res.status(400).json({ message: 'id_maquina debe ser numerico y mayor o igual a 0' });
    }

    const margenRaw = req.query.margen_minimo_horas;
    const margenMinimoHoras = margenRaw === undefined || margenRaw === null || margenRaw === ''
      ? 50
      : Number(margenRaw);

    if (!Number.isFinite(margenMinimoHoras) || margenMinimoHoras < 0) {
      return res.status(400).json({ message: 'margen_minimo_horas debe ser numerico y no negativo' });
    }

    const data = await maquinariaRepo.getDisponibilidadMaquina(id_maquina, margenMinimoHoras);
    if (!data) {
      return res.status(404).json({ message: 'Maquinaria no encontrada' });
    }

    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

async function listUrgentMaintenance(req, res, next) {
  try {
    const umbralRaw = req.query.umbral;
    const limitRaw = req.query.limit;
    const offsetRaw = req.query.offset;

    const umbral = umbralRaw === undefined || umbralRaw === null || umbralRaw === '' ? 0 : Number(umbralRaw);
    const limit = limitRaw === undefined || limitRaw === null || limitRaw === '' ? null : Number(limitRaw);
    const offset = offsetRaw === undefined || offsetRaw === null || offsetRaw === '' ? null : Number(offsetRaw);

    if (Number.isNaN(umbral) || (limit !== null && Number.isNaN(limit)) || (offset !== null && Number.isNaN(offset))) {
      return res.status(400).json({ message: 'Parámetros de query inválidos: umbral, limit, offset deben ser numéricos' });
    }

    const data = await maquinariaRepo.listMaquinasConMantenimientoUrgente(Number(umbral || 0), limit, offset);
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

async function getIncidencias(req, res, next) {
  try {
    const id_maquina = toNumberOrNull(req.params.id_maquina);
    if (id_maquina === null) {
      return res.status(400).json({ message: 'id_maquina debe ser numerico y mayor o igual a 0' });
    }

    const soloNoResueltas = req.query.solo_no_resueltas === 'true' || req.query.solo_no_resueltas === '1';
    const incidencias = await maquinariaRepo.listIncidenciasByMaquina(id_maquina, soloNoResueltas);
    return res.json(incidencias);
  } catch (error) {
    return next(error);
  }
}

async function getMisAsignaciones(req, res, next) {
  try {
    const operadorId = toNumberOrNull(req.user?.id_usuario);
    if (operadorId === null) {
      return res.status(400).json({ message: 'No se pudo identificar al usuario autenticado' });
    }

    const asignaciones = await maquinariaRepo.listMaquinasAsignadasByOperador(operadorId);
    return res.json(asignaciones);
  } catch (error) {
    return next(error);
  }
}

function validateIncidenciaPayload(payload) {
  const descripcion = payload.descripcion ? payload.descripcion.toString().trim() : '';
  const criticidad = payload.criticidad ? payload.criticidad.toString().trim() : 'Media';
  const operador_id = toNumberOrNull(payload.operador_id);
  const fecha = payload.fecha ? new Date(payload.fecha) : new Date();
  const mantenimiento_id = payload.mantenimiento_id !== undefined && payload.mantenimiento_id !== null && payload.mantenimiento_id !== ''
    ? toNumberOrNull(payload.mantenimiento_id)
    : null;
  const orden_trabajo_id = payload.orden_trabajo_id !== undefined && payload.orden_trabajo_id !== null && payload.orden_trabajo_id !== ''
    ? toNumberOrNull(payload.orden_trabajo_id)
    : null;

  if (!descripcion) {
    return { error: 'descripcion es obligatoria', parsed: null };
  }

  if (descripcion.length < 10) {
    return { error: 'descripcion debe tener al menos 10 caracteres', parsed: null };
  }

  if (operador_id === null) {
    return { error: 'operador_id es obligatorio y debe ser numerico', parsed: null };
  }

  if (!['Alta', 'Media', 'Baja'].includes(criticidad)) {
    return { error: 'criticidad invalida. Valores permitidos: Alta, Media, Baja', parsed: null };
  }

  if (!(fecha instanceof Date) || Number.isNaN(fecha.getTime())) {
    return { error: 'fecha invalida', parsed: null };
  }

  if (mantenimiento_id !== null && mantenimiento_id < 0) {
    return { error: 'mantenimiento_id debe ser numerico y mayor o igual a 0', parsed: null };
  }

  if (orden_trabajo_id !== null && orden_trabajo_id < 0) {
    return { error: 'orden_trabajo_id debe ser numerico y mayor o igual a 0', parsed: null };
  }

  return {
    error: null,
    parsed: {
      fecha: fecha.toISOString().slice(0, 10),
      descripcion,
      criticidad,
      operador_id,
      // No se exige orden/mantenimiento para registrar incidencia general de máquina.
      vinculada_mantenimiento: mantenimiento_id !== null || orden_trabajo_id !== null,
      mantenimiento_id,
      orden_trabajo_id
    }
  };
}

async function createIncidencia(req, res, next) {
  try {
    const id_maquina = toNumberOrNull(req.params.id_maquina);
    if (id_maquina === null) {
      return res.status(400).json({ message: 'id_maquina debe ser numerico y mayor o igual a 0' });
    }

    const { error, parsed } = validateIncidenciaPayload(req.body);
    if (error) {
      return res.status(400).json({ message: error });
    }

    const maquina = await maquinariaRepo.getMaquinariaById(id_maquina);
    if (!maquina) {
      return res.status(404).json({ message: 'Maquinaria no encontrada' });
    }

    const operador = await usuariosRepo.getUsuarioById(parsed.operador_id);
    if (!operador) {
      return res.status(404).json({ message: 'Operador no encontrado' });
    }

    if (parsed.mantenimiento_id !== null) {
      const mantenimiento = await mantenimientosRepo.getMantenimientoById(parsed.mantenimiento_id);
      if (!mantenimiento) {
        return res.status(400).json({ message: 'mantenimiento_id no corresponde a un mantenimiento existente' });
      }
    }

    if (parsed.orden_trabajo_id !== null) {
      const ordenTrabajo = await mantenimientosRepo.getOrdenTrabajoById(parsed.orden_trabajo_id);
      if (!ordenTrabajo) {
        return res.status(400).json({ message: 'orden_trabajo_id no corresponde a una orden existente' });
      }

      if (Number(ordenTrabajo.maquinaria_id_maquina) !== Number(id_maquina)) {
        return res.status(400).json({
          message: 'La orden seleccionada no pertenece a la máquina indicada para la incidencia'
        });
      }
    }

    const incidencia = await maquinariaRepo.createIncidenciaForMaquina({
      maquinaria_id_maquina: id_maquina,
      operador_id: parsed.operador_id,
      fecha: parsed.fecha,
      descripcion: parsed.descripcion,
      criticidad: parsed.criticidad,
      vinculada_mantenimiento: parsed.vinculada_mantenimiento,
      mantenimiento_id: parsed.mantenimiento_id,
      orden_trabajo_id: parsed.orden_trabajo_id
    });

    return res.status(201).json({ message: 'Incidencia registrada con estado Pendiente', incidencia });
  } catch (error) {
    if (error.code === '23503') {
      return res.status(400).json({ message: 'Referencia invalida en operador, maquina o mantenimiento' });
    }
    return next(error);
  }
}

async function create(req, res, next) {
  try {
    const { error, parsed } = validatePayload(req.body);
    if (error) {
      return res.status(400).json({ message: error });
    }

    const data = await maquinariaRepo.createMaquinaria(parsed);

    // Bloqueo automático inmediato cuando la maquinaria ya supera el umbral del plan al momento del alta.
    if (data?.planes_mantencion_id_plan) {
      const plan = await planesRepo.obtenerPlanPorId(data.planes_mantencion_id_plan);
      const intervaloHoras = Number(plan?.intervalo_horas || 0);
      const horometroActual = Number(data.horometro_actual || 0);
      const horasRestantes = intervaloHoras - horometroActual;

      if (intervaloHoras > 0 && horasRestantes <= 0) {
        const motivoBloqueo = `Bloqueo automático por umbral de mantenimiento excedido al crear maquinaria (${horometroActual}h >= ${intervaloHoras}h del plan).`;

        await maquinariaRepo.blockMaquinariaWithReason(data.id_maquina, motivoBloqueo, 0);
        await alertasCriticasRepo.verificarYGenerarAlertaCritica(
          data.id_maquina,
          horometroActual,
          intervaloHoras,
          0
        );

        const bloqueada = await maquinariaRepo.getMaquinariaById(data.id_maquina);
        return res.status(201).json(bloqueada || data);
      }
    }

    return res.status(201).json(data);
  } catch (error) {
    return next(error);
  }
}

async function asignarOperador(req, res, next) {
  try {
    const id_maquina = toNumberOrNull(req.params.id_maquina);
    if (id_maquina === null) {
      return res.status(400).json({ message: 'id_maquina debe ser numerico' });
    }

    const operadorId = toNumberOrNull(req.body.operador_id ?? req.body.operadorId);
    if (operadorId === null) {
      return res.status(400).json({ message: 'operador_id es requerido y debe ser numerico' });
    }

    const maquina = await maquinariaRepo.getMaquinariaById(id_maquina);
    if (!maquina) {
      return res.status(404).json({ message: 'Maquinaria no encontrada' });
    }

    const operador = await usuariosRepo.getUsuarioById(operadorId);
    if (!operador) {
      return res.status(404).json({ message: 'Operador no encontrado' });
    }

    const asignacion = await maquinariaRepo.asignarOperadorAMaquina({
      maquinaria_id_maquina: id_maquina,
      operador_id: operadorId,
      fecha_inicio: req.body.fecha_inicio || null,
      fecha_fin: req.body.fecha_fin || null
    });

    return res.status(201).json({
      message: 'Operador asignado correctamente',
      asignacion
    });
  } catch (error) {
    return next(error);
  }
}

async function desasignarOperador(req, res, next) {
  try {
    const id_maquina = toNumberOrNull(req.params.id_maquina);
    if (id_maquina === null) {
      return res.status(400).json({ message: 'id_maquina debe ser numerico' });
    }

    const maquina = await maquinariaRepo.getMaquinariaById(id_maquina);
    if (!maquina) {
      return res.status(404).json({ message: 'Maquinaria no encontrada' });
    }

    const asignacion = await maquinariaRepo.finalizarAsignacionActivaByMaquina(id_maquina, req.body.fecha_fin || null);

    if (!asignacion) {
      return res.status(404).json({ message: 'La máquina no tiene una asignación activa' });
    }

    return res.json({
      message: 'Asignación finalizada correctamente',
      asignacion
    });
  } catch (error) {
    return next(error);
  }
}

async function update(req, res, next) {
  try {
    const id_maquina = toNumberOrNull(req.params.id_maquina);
    if (id_maquina === null) {
      return res.status(400).json({ message: 'id_maquina debe ser numerico y mayor o igual a 0' });
    }

    const { error, parsed } = validatePayload(req.body);
    if (error) {
      return res.status(400).json({ message: error });
    }

    const current = await maquinariaRepo.getMaquinariaById(id_maquina);
    if (!current) {
      return res.status(404).json({ message: 'Maquinaria no encontrada' });
    }

    if (Number(parsed.horometro_actual) < Number(current.horometro_actual)) {
      return res.status(400).json({
        message: 'El horometro_actual no puede ser menor al valor previamente registrado'
      });
    }

    const payload = {
      ...parsed,
      tarifa_diaria: parsed.tarifa_diaria === undefined ? current.tarifa_diaria : parsed.tarifa_diaria
    };

    const motivoNoOperativa = String(req.body?.motivo_no_operativa || req.body?.motivo || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (payload.estado === 'No Operativa' && motivoNoOperativa.length < 8) {
      return res.status(400).json({
        message: 'Debes ingresar un motivo (mínimo 8 caracteres) para marcar la máquina como No Operativa'
      });
    }

    const data = await maquinariaRepo.updateMaquinaria(id_maquina, payload);
    if (!data) {
      return res.status(404).json({ message: 'Maquinaria no encontrada' });
    }

    if (payload.estado === 'No Operativa') {
      await maquinariaRepo.blockMaquinariaWithReason(
        id_maquina,
        motivoNoOperativa,
        0,
        'No Operativa'
      );
      const noOperativa = await maquinariaRepo.getMaquinariaById(id_maquina);
      return res.json(noOperativa || data);
    }

    // Bloqueo automático también en edición: evita que una máquina vencida quede "Disponible".
    if (data?.planes_mantencion_id_plan && data.estado !== 'No Operativa') {
      const plan = await planesRepo.obtenerPlanPorId(data.planes_mantencion_id_plan);
      const intervaloHoras = Number(plan?.intervalo_horas || 0);
      const horometroActual = Number(data.horometro_actual || 0);
      const horasRestantes = intervaloHoras - horometroActual;

      if (intervaloHoras > 0 && horasRestantes <= 0) {
        const motivoBloqueo = `Bloqueo automático por umbral de mantenimiento excedido en edición (${horometroActual}h >= ${intervaloHoras}h del plan).`;

        await maquinariaRepo.blockMaquinariaWithReason(id_maquina, motivoBloqueo, 0);
        await alertasCriticasRepo.verificarYGenerarAlertaCritica(
          id_maquina,
          horometroActual,
          intervaloHoras,
          0
        );

        const bloqueada = await maquinariaRepo.getMaquinariaById(id_maquina);
        return res.json(bloqueada || data);
      }
    }

    return res.json(data);
  } catch (error) {
    if (error.code === '23514' || error.code === 'P0001') {
      return res.status(400).json({
        message: 'El horometro_actual no puede ser menor al valor previamente registrado'
      });
    }
    return next(error);
  }
}

async function markAsNotOperative(req, res, next) {
  try {
    const id = toNumberOrNull(req.params.id_maquina);
    if (id === null) {
      return res.status(400).json({ message: 'id_maquina debe ser numerico' });
    }

    const maq = await maquinariaRepo.getMaquinariaById(id);
    if (!maq) {
      return res.status(404).json({ message: 'Maquinaria no encontrada' });
    }

    const motivo = String(req.body?.motivo || req.body?.motivo_no_operativa || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (motivo.length < 8) {
      return res.status(400).json({
        message: 'Debes ingresar un motivo (mínimo 8 caracteres) para marcar la máquina como No Operativa'
      });
    }

    await maquinariaRepo.blockMaquinariaWithReason(id, motivo, 0, 'No Operativa');
    const updated = await maquinariaRepo.getMaquinariaById(id);

    return res.json(updated);
  } catch (error) {
    return next(error);
  }
}

async function notifyOperator(req, res, next) {
  try {
    const id_maquina = toNumberOrNull(req.params.id_maquina);
    if (id_maquina === null) {
      return res.status(400).json({ message: 'id_maquina debe ser numerico' });
    }

    const operadorId = toNumberOrNull(req.body.operador_id ?? req.body.operadorId ?? 4);
    if (operadorId === null) {
      return res.status(400).json({ message: 'operador_id debe ser numerico y mayor o igual a 0' });
    }

    const maquina = await maquinariaRepo.getMaquinariaById(id_maquina);
    if (!maquina) {
      return res.status(404).json({ message: 'Maquinaria no encontrada' });
    }

    const operador = await usuariosRepo.getUsuarioById(operadorId);
    if (!operador) {
      return res.status(404).json({ message: 'Operador no encontrado' });
    }

    const estadoCritico = new Set(['Bloqueada', 'No Operativa']);
    if (!estadoCritico.has(maquina.estado)) {
      return res.status(400).json({ message: 'La máquina no está en estado crítico para notificar al operador.' });
    }

    const bloqueoActivo = await maquinariaRepo.getBloqueoMaquinaria(id_maquina);
    const motivoBloqueo = bloqueoActivo?.motivo_bloqueo || req.body.motivo || (maquina.estado === 'Bloqueada'
      ? 'La máquina está bloqueada por seguridad y requiere autorización administrativa.'
      : 'La máquina está marcada como no operativa y no puede usarse sin revisión.');

    const mensaje = `Advertencia al operador: ${maquina.modelo_equipo} se encuentra en estado "${maquina.estado}". ${motivoBloqueo}`;

    const { rows } = await pool.query(
      `INSERT INTO notificaciones (usuario_id, tipo_notificacion, referencia_id, mensaje)
       VALUES ($1, 'Bloqueo', $2, $3)
       RETURNING *;`,
      [operadorId, id_maquina, mensaje]
    );

    console.log(`[maquinaria] Operador ${operadorId} notificado sobre máquina ${id_maquina} (${maquina.modelo_equipo}) en estado "${maquina.estado}"`);

    return res.status(201).json({
      message: 'Notificación registrada. El operador fue advertido antes de cualquier acción.',
      notificacion: rows[0]
    });
  } catch (error) {
    if (error.code === '23503') {
      return res.status(400).json({ message: 'Referencia inválida en operador o máquina' });
    }
    return next(error);
  }
}

async function remove(req, res, next) {
  try {
    const id_maquina = toNumberOrNull(req.params.id_maquina);
    if (id_maquina === null) {
      return res.status(400).json({ message: 'id_maquina debe ser numerico y mayor o igual a 0' });
    }

    const deleted = await maquinariaRepo.deleteMaquinaria(id_maquina);
    if (!deleted) {
      return res.status(404).json({ message: 'Maquinaria no encontrada' });
    }

    return res.status(204).send();
  } catch (error) {
    if (error.code === '23503') {
      return res.status(409).json({
        message: 'No se puede eliminar la maquinaria porque tiene registros asociados (historial o mantenimientos).'
      });
    }
    return next(error);
  }
}

async function blockCritical(req, res, next) {
  try {
    const id_maquina = toNumberOrNull(req.params.id_maquina);
    if (id_maquina === null) {
      return res.status(400).json({ message: 'id_maquina debe ser numerico' });
    }

    const { motivo_bloqueo, costo_estimado_reparacion } = req.body;
    if (!motivo_bloqueo || typeof motivo_bloqueo !== 'string' || motivo_bloqueo.trim() === '') {
      return res.status(400).json({ message: 'motivo_bloqueo es obligatorio y debe ser texto' });
    }

    const costo = costo_estimado_reparacion !== undefined 
      ? toNumberOrNull(costo_estimado_reparacion) 
      : 0;

    if (costo === null || costo < 0) {
      return res.status(400).json({ message: 'costo_estimado_reparacion debe ser numerico y no negativo' });
    }

    const bloqueo = await maquinariaRepo.blockMaquinariaWithReason(id_maquina, motivo_bloqueo.trim(), costo);
    return res.status(201).json({
      message: 'Máquina bloqueada crítica registrada',
      bloqueo
    });
  } catch (error) {
    if (error.message === 'Maquinaria no encontrada') {
      return res.status(404).json({ message: error.message });
    }
    return next(error);
  }
}

async function getBloqueo(req, res, next) {
  try {
    const id_maquina = toNumberOrNull(req.params.id_maquina);
    if (id_maquina === null) {
      return res.status(400).json({ message: 'id_maquina debe ser numerico' });
    }

    const bloqueo = await maquinariaRepo.getBloqueoMaquinaria(id_maquina);
    if (!bloqueo) {
      return res.status(404).json({ message: 'Máquina no tiene bloqueos activos' });
    }

    return res.json(bloqueo);
  } catch (error) {
    return next(error);
  }
}

async function unblock(req, res, next) {
  try {
    const id_maquina = toNumberOrNull(req.params.id_maquina);
    if (id_maquina === null) {
      return res.status(400).json({ message: 'id_maquina debe ser numerico' });
    }

    const result = await maquinariaRepo.unblockMaquinaria(id_maquina);
    return res.json({
      message: 'Máquina desbloqueada exitosamente',
      ...result
    });
  } catch (error) {
    if (error.message === 'Maquinaria no encontrada') {
      return res.status(404).json({ message: error.message });
    }
    return next(error);
  }
}

module.exports = {
  list,
  getById,
  getHorasAcumuladas,
  getDisponibilidad,
  listUrgentMaintenance,
  getIncidencias,
  getMisAsignaciones,
  createIncidencia,
  create,
  update,
  markAsNotOperative,
  notifyOperator,
  asignarOperador,
  desasignarOperador,
  blockCritical,
  getBloqueo,
  unblock,
  remove
};
