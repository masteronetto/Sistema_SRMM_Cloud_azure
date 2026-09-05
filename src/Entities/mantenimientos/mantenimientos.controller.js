const mantenimientosRepo = require('./mantenimientos.repository');
const maquinariaRepo = require('../maquinaria/maquinaria.repository');
const usuariosRepo = require('../usuarios/usuarios.repository');
const notificacionesTiempoRealRepo = require('../notificaciones_tiempo_real/notificaciones_tiempo_real.repository');
const { enviarNotificacionAAdministradores, enviarNotificacionAMecanico } = require('../../config/socketio');

const TIPOS_SERVICIO_PROGRAMACION = new Set(['Preventivo', 'Correctivo', 'Predictivo']);
const TIPOS_SERVICIO_MANTENIMIENTO = new Set([
  'Preventivo',
  'Correctivo',
  'Predictivo',
  'Inspeccion',
  'Inspección',
  'Lubricacion',
  'Lubricación',
  'Ajuste',
  'Cambio de Repuestos',
  'Cambio de Repuesto',
  'Reparacion',
  'Reparación',
  'Diagnostico',
  'Diagnóstico'
]);

function sanitizeTextInput(value) {
  if (value === undefined || value === null) {
    return '';
  }

  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeServiceType(value) {
  return sanitizeTextInput(value)
    .replace(/\s+/g, ' ')
    .replace(/^./, (char) => char.toUpperCase());
}

function isAllowedServiceType(value, allowedSet = TIPOS_SERVICIO_MANTENIMIENTO) {
  const normalized = normalizeServiceType(value);
  if (normalized.length < 3 || normalized.length > 80) {
    return false;
  }

  if (!/^[\p{L}\p{N}][\p{L}\p{N}\s().,/-]*$/u.test(normalized)) {
    return false;
  }

  return allowedSet.has(normalized) || allowedSet.has(normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
}

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

function normalizeDateInput(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmedValue = value.trim();
  const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!isoDatePattern.test(trimmedValue)) {
    return null;
  }

  const parsedDate = new Date(`${trimmedValue}T00:00:00Z`);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return trimmedValue;
}

function escapeCsvValue(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).replace(/"/g, '""');
}

function buildHistorialCsv(rows) {
  const header = [
    'id_mantencion',
    'fecha_servicio',
    'tipo_servicio',
    'maquinaria_id_maquina',
    'modelo_equipo',
    'horometro_registro',
    'usuarios_id_usuario',
    'usuario_responsable',
    'detalle_tecnico'
  ];

  const lines = [header.join(',')];

  rows.forEach((row) => {
    lines.push([
      row.id_mantencion,
      row.fecha_servicio,
      row.tipo_servicio,
      row.maquinaria_id_maquina,
      row.modelo_equipo,
      row.horometro_registro,
      row.usuarios_id_usuario,
      row.usuario_responsable,
      row.detalle_tecnico
    ].map((value) => `"${escapeCsvValue(value)}"`).join(','));
  });

  return lines.join('\n');
}

function successPayload(data, extras = {}) {
  return {
    data,
    ...extras,
  };
}

function validatePayload(payload) {
  const tipo_servicio = normalizeServiceType(payload.tipo_servicio);
  const horometro_registro = toNumberOrNull(payload.horometro_registro);
  const maquinaria_id_maquina = toNumberOrNull(payload.maquinaria_id_maquina);
  const usuarios_id_usuario = toNumberOrNull(payload.usuarios_id_usuario);
  const detalle_tecnico = sanitizeTextInput(payload.detalle_tecnico);

  if (!tipo_servicio || horometro_registro === null || maquinaria_id_maquina === null || usuarios_id_usuario === null || !detalle_tecnico) {
    return {
      error: 'Campos obligatorios: tipo_servicio, horometro_registro, detalle_tecnico, maquinaria_id_maquina, usuarios_id_usuario',
      parsed: null
    };
  }

  if (!isAllowedServiceType(tipo_servicio)) {
    return {
      error: 'tipo_servicio debe usar un formato válido y reconocido',
      parsed: null
    };
  }

  if (detalle_tecnico.length < 10) {
    return {
      error: 'detalle_tecnico debe tener al menos 10 caracteres útiles',
      parsed: null
    };
  }

  const fecha_servicio = payload.fecha_servicio || null;

  return {
    error: null,
    parsed: {
      tipo_servicio,
      horometro_registro,
      detalle_tecnico,
      fecha_servicio,
      maquinaria_id_maquina,
      usuarios_id_usuario
    }
  };
}

async function create(req, res, next) {
  try {
    const { error, parsed } = validatePayload(req.body);
    if (error) {
      return res.status(400).json({ message: error });
    }

    const maquinaria = await maquinariaRepo.getMaquinariaById(parsed.maquinaria_id_maquina);
    if (!maquinaria) {
      return res.status(404).json({ message: 'Maquinaria no encontrada' });
    }

    const usuario = await usuariosRepo.getUsuarioById(parsed.usuarios_id_usuario);
    if (!usuario) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    if (parsed.horometro_registro > Number(maquinaria.horometro_actual)) {
      return res.status(400).json({
        message: 'horometro_registro no puede ser mayor al horometro_actual de la maquinaria'
      });
    }

    const data = await mantenimientosRepo.createMantenimiento(parsed);
    return res.status(201).json(successPayload(data));
  } catch (error) {
    if (error.code === '23503') {
      return res.status(400).json({ message: 'Referencia invalida en maquinaria o usuarios' });
    }
    return next(error);
  }
}

async function listByMaquina(req, res, next) {
  try {
    const maquinaria_id_maquina = toNumberOrNull(req.params.maquinaria_id_maquina);
    if (maquinaria_id_maquina === null) {
      return res.status(400).json({ message: 'maquinaria_id_maquina debe ser numerico y mayor o igual a 0' });
    }

    const data = await mantenimientosRepo.listMantenimientosByMaquina(maquinaria_id_maquina);
    return res.json(successPayload(data, { cantidad: data.length }));
  } catch (error) {
    return next(error);
  }
}

async function historialByMaquina(req, res, next) {
  try {
    const maquinaria_id_maquina = toNumberOrNull(req.params.maquinaria_id_maquina);
    if (maquinaria_id_maquina === null) {
      return res.status(400).json({ message: 'maquinaria_id_maquina debe ser numerico y mayor o igual a 0' });
    }

    const fecha_inicio = normalizeDateInput(req.query.fecha_inicio);
    const fecha_fin = normalizeDateInput(req.query.fecha_fin);
    const tipo_servicio = typeof req.query.tipo_servicio === 'string' && req.query.tipo_servicio.trim() !== ''
      ? req.query.tipo_servicio.trim()
      : null;
    const order = typeof req.query.order === 'string' && req.query.order.trim() !== ''
      ? req.query.order.trim().toLowerCase()
      : 'desc';
    const page = req.query.page === undefined || req.query.page === null || req.query.page === ''
      ? null
      : toNumberOrNull(req.query.page);
    const perPage = req.query.per_page === undefined || req.query.per_page === null || req.query.per_page === ''
      ? null
      : toNumberOrNull(req.query.per_page);
    const limit = req.query.limit === undefined || req.query.limit === null || req.query.limit === ''
      ? null
      : toNumberOrNull(req.query.limit);
    const offset = req.query.offset === undefined || req.query.offset === null || req.query.offset === ''
      ? null
      : toNumberOrNull(req.query.offset);

    const effectiveLimit = limit !== null ? limit : (perPage !== null ? perPage : null);
    const effectiveOffset = offset !== null ? offset : (page !== null && perPage !== null ? (Math.max(1, page) - 1) * perPage : null);

    if (
      (req.query.fecha_inicio && fecha_inicio === null) ||
      (req.query.fecha_fin && fecha_fin === null) ||
      (req.query.page !== undefined && req.query.page !== null && req.query.page !== '' && page === null) ||
      (req.query.per_page !== undefined && req.query.per_page !== null && req.query.per_page !== '' && perPage === null) ||
      (req.query.limit !== undefined && req.query.limit !== null && req.query.limit !== '' && limit === null) ||
      (req.query.offset !== undefined && req.query.offset !== null && req.query.offset !== '' && offset === null)
    ) {
      return res.status(400).json({
        message: 'fecha_inicio y fecha_fin deben usar formato YYYY-MM-DD; page, per_page, limit y offset deben ser numericos'
      });
    }

    const dataFiltros = {
      fecha_inicio,
      fecha_fin,
      tipo_servicio,
      order,
      limit: effectiveLimit,
      offset: effectiveOffset
    };

    const historialResult = await mantenimientosRepo.listHistorialMantencionesByMaquina(maquinaria_id_maquina, dataFiltros);

    if (typeof req.query.format === 'string' && req.query.format.toLowerCase() === 'csv') {
      const csvResult = await mantenimientosRepo.listHistorialMantencionesByMaquina(maquinaria_id_maquina, {
        fecha_inicio,
        fecha_fin,
        tipo_servicio,
        order,
        limit: null,
        offset: null
      });
      const csv = buildHistorialCsv(csvResult.rows);
      const fileName = `historial_mantenciones_maquina_${maquinaria_id_maquina}.csv`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      return res.status(200).send(`\uFEFF${csv}`);
    }

    return res.json(successPayload(historialResult.rows, {
      maquinaria_id_maquina,
      filtros: {
        fecha_inicio,
        fecha_fin,
        tipo_servicio,
        order,
        page,
        per_page: perPage,
        limit: effectiveLimit,
        offset: effectiveOffset
      },
      cantidad: historialResult.rows.length,
      total: historialResult.total,
      historial: historialResult.rows
    }));
  } catch (error) {
    return next(error);
  }
}

async function tiposServicio(req, res, next) {
  try {
    const tipos = await mantenimientosRepo.listTiposServicio();
    return res.json(successPayload(tipos, { cantidad: tipos.length }));
  } catch (error) {
    return next(error);
  }
}

async function programar(req, res, next) {
  try {
    const { tipo_servicio, detalle_tecnico, fecha_programada, maquinaria_id_maquina, mecanico_asignado } = req.body;
    const pool = require('../../db/pool');
    const maq_id = toNumberOrNull(maquinaria_id_maquina);
    const mec_id = toNumberOrNull(mecanico_asignado);
    const tipoServicioNormalizado = normalizeServiceType(tipo_servicio);
    const detalleTecnicoNormalizado = sanitizeTextInput(detalle_tecnico);

    if (!tipoServicioNormalizado || !detalleTecnicoNormalizado || !fecha_programada || maq_id === null || mec_id === null) {
      return res.status(400).json({ 
        message: 'Campos obligatorios: tipo_servicio, detalle_tecnico, fecha_programada, maquinaria_id_maquina, mecanico_asignado' 
      });
    }

    if (!TIPOS_SERVICIO_PROGRAMACION.has(tipoServicioNormalizado) || detalleTecnicoNormalizado.length < 10) {
      return res.status(400).json({
        message: 'tipo_servicio debe ser uno de: Preventivo, Correctivo o Predictivo y el detalle técnico debe tener al menos 10 caracteres'
      });
    }

    // Validar formato de fecha
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(fecha_programada)) {
      return res.status(400).json({ message: 'fecha_programada debe tener formato YYYY-MM-DD' });
    }

    // Validar que la fecha sea futura o hoy
    const programada = new Date(fecha_programada);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    if (programada < hoy) {
      return res.status(400).json({ message: 'fecha_programada no puede ser en el pasado' });
    }

    const maquina = await maquinariaRepo.getMaquinariaById(maq_id);
    if (!maquina) {
      return res.status(404).json({ message: 'Maquinaria no encontrada' });
    }

    if (String(maquina.estado || '').trim() === 'Bloqueada') {
      return res.status(400).json({
        message: 'La máquina está bloqueada por umbral crítico de mantenimiento. Debe regularizarse antes de programar nuevas órdenes.'
      });
    }

    const mecanico = await usuariosRepo.getUsuarioById(mec_id);
    if (!mecanico) {
      return res.status(404).json({ message: 'Mecánico no encontrado' });
    }

    const orden = await mantenimientosRepo.programarMantenimiento({
      tipo_servicio: tipoServicioNormalizado,
      detalle_tecnico: detalleTecnicoNormalizado,
      fecha_programada,
      maquinaria_id_maquina: maq_id,
      mecanico_asignado: mec_id
    });

    // Cambiar estado de máquina a 'En Mantencion'
    await maquinariaRepo.updateMaquinaria(maq_id, {
      modelo_equipo: maquina.modelo_equipo,
      horometro_actual: maquina.horometro_actual,
      estado: 'Mantencion',
      especificaciones: maquina.especificaciones,
      planes_mantencion_id_plan: maquina.planes_mantencion_id_plan
    });

    // Crear notificación para el mecánico
    const notificacionMensaje = `Nueva orden de trabajo asignada: ${tipoServicioNormalizado} para máquina ${maquina.modelo_equipo} programada para ${fecha_programada}`;

    await pool.query(
      `INSERT INTO notificaciones (usuario_id, tipo_notificacion, referencia_id, mensaje) 
       VALUES ($1, 'Orden Trabajo', $2, $3)`,
      [
        mec_id,
        orden.id_orden,
        notificacionMensaje
      ]
    );

    const io = req.app.get('io');
    if (io) {
      enviarNotificacionAMecanico(io, mec_id, {
        tipo: 'Orden Trabajo',
        ordenId: orden.id_orden,
        maquinariaId: maq_id,
        mecanicoId: mec_id,
        mensaje: notificacionMensaje,
        tipoServicio: tipoServicioNormalizado,
        fechaProgramada: fecha_programada,
        maquinaria: maquina.modelo_equipo
      });
    }

    return res.status(201).json(successPayload(orden, {
      message: 'Mantenimiento programado exitosamente. Máquina cambiada a estado "En Mantencion"'
    }));
  } catch (error) {
    if (error.code === '23503') {
      return res.status(400).json({ message: 'Referencia inválida en maquinaria o usuarios' });
    }
    return next(error);
  }
}

async function listOrdenesMaquina(req, res, next) {
  try {
    const maquinaria_id_maquina = toNumberOrNull(req.params.maquinaria_id_maquina);
    if (maquinaria_id_maquina === null) {
      return res.status(400).json({ message: 'maquinaria_id_maquina debe ser numérico' });
    }

    const ordenes = await mantenimientosRepo.listOrdenesByMaquina(maquinaria_id_maquina);
    return res.json(successPayload(ordenes, { cantidad: ordenes.length }));
  } catch (error) {
    return next(error);
  }
}

async function listOrdenes(req, res, next) {
  try {
    const page = req.query.page === undefined || req.query.page === null || req.query.page === ''
      ? 1
      : toNumberOrNull(req.query.page);
    const perPage = req.query.perPage === undefined || req.query.perPage === null || req.query.perPage === ''
      ? 10
      : toNumberOrNull(req.query.perPage);

    if (page === null || perPage === null) {
      return res.status(400).json({ message: 'page y perPage deben ser numéricos' });
    }

    const limit = Math.max(1, perPage);
    const offset = (Math.max(1, page) - 1) * limit;
    const result = await mantenimientosRepo.listOrdenes({ limit, offset });

    return res.json(successPayload(result.rows, {
      cantidad: result.rows.length,
      total: result.total,
      page: Math.max(1, page),
      perPage: limit,
    }));
  } catch (error) {
    return next(error);
  }
}

async function listOrdenesMecanico(req, res, next) {
  try {
    const mecanico_id = toNumberOrNull(req.params.mecanico_id);
    if (mecanico_id === null) {
      return res.status(400).json({ message: 'mecanico_id debe ser numérico' });
    }

    const estado = req.query.estado || null; // e.g., 'Programada', 'En Progreso'
    const ordenes = await mantenimientosRepo.listOrdenesByMecanico(mecanico_id, estado);
    return res.json(successPayload(ordenes, { cantidad: ordenes.length }));
  } catch (error) {
    return next(error);
  }
}

async function iniciar(req, res, next) {
  try {
    const id_orden = toNumberOrNull(req.params.id_orden);
    if (id_orden === null) {
      return res.status(400).json({ message: 'id_orden debe ser numérico' });
    }

    const orden = await mantenimientosRepo.iniciarOrdenTrabajo(id_orden);
    if (!orden) {
      return res.status(404).json({ message: 'Orden no encontrada o ya fue iniciada' });
    }

    return res.json(successPayload(orden, {
      message: 'Orden de trabajo iniciada'
    }));
  } catch (error) {
    return next(error);
  }
}

/**
 * PATCH /api/mantenimientos/ordenes/:id_orden/completar
 * Completar una orden de trabajo
 * Body: { horometro_registro? }
 */
async function completar(req, res, next) {
  try {
    const id_orden = toNumberOrNull(req.params.id_orden);
    if (id_orden === null) {
      return res.status(400).json({ message: 'id_orden debe ser numérico' });
    }

    const hasHorometro = !!(req.body && Object.prototype.hasOwnProperty.call(req.body, 'horometro_registro'));
    const horometro = hasHorometro ? toNumberOrNull(req.body.horometro_registro) : null;
    if (hasHorometro && horometro === null) {
      return res.status(400).json({ message: 'horometro_registro debe ser numérico y mayor o igual a 0' });
    }

    const orden = await mantenimientosRepo.completarOrdenTrabajo(id_orden, horometro);
    if (!orden) {
      return res.status(404).json({ message: 'Orden no encontrada o no se pudo completar' });
    }

    return res.json(successPayload(orden, {
      message: 'Orden completada'
    }));
  } catch (error) {
    if (error.code === 'INVALID_HOROMETRO') {
      return res.status(400).json({ message: error.message });
    }
    return next(error);
  }
}

async function listOrdenesAtrasadas(req, res, next) {
  try {
    const ordenes = await mantenimientosRepo.listOrdenesAtrasadas();
    return res.json(successPayload(ordenes, { cantidad: ordenes.length }));
  } catch (error) {
    return next(error);
  }
}

async function verificarRetrasos(req, res, next) {
  try {
    const resultado = await procesarRetrasos(req.app.get('io'));

    return res.status(200).json(successPayload(resultado));
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/mantenimientos/ordenes/:id_orden
 * Obtener una orden de trabajo por su ID
 */
async function getOrdenById(req, res, next) {
  try {
    const id_orden = toNumberOrNull(req.params.id_orden);
    if (id_orden === null) {
      return res.status(400).json({ message: 'id_orden debe ser numérico' });
    }

    const orden = await mantenimientosRepo.getOrdenTrabajoById(id_orden);
    if (!orden) {
      return res.status(404).json({ message: 'Orden de trabajo no encontrada' });
    }

    return res.json(successPayload(orden));
  } catch (error) {
    return next(error);
  }
}

async function eliminarOrden(req, res, next) {
  try {
    const id_orden = toNumberOrNull(req.params.id_orden);
    if (id_orden === null) {
      return res.status(400).json({ message: 'id_orden debe ser numérico' });
    }

    const orden = await mantenimientosRepo.deleteOrdenTrabajo(id_orden);
    if (!orden) {
      return res.status(404).json({ message: 'Orden de trabajo no encontrada' });
    }

    return res.json(successPayload(orden, { message: 'Orden eliminada correctamente' }));
  } catch (error) {
    return next(error);
  }
}

async function procesarRetrasos(io) {
  const ordenes = await mantenimientosRepo.listOrdenesAtrasadas();
  const adminId = 1;
  const notificadas = [];

  for (const orden of ordenes) {
    if (orden.alerta_retraso_enviada) {
      continue;
    }

    const diasAtraso = Number(orden.dias_atraso) || 0;
    const prioridad = diasAtraso >= 7 ? 'Alta' : diasAtraso >= 3 ? 'Media' : 'Baja';
    const mensaje = `La orden de mantenimiento de ${orden.modelo_equipo} está retrasada ${diasAtraso} día(s). Mecánico asignado: ${orden.mecanico_nombre}.`;

    await notificacionesTiempoRealRepo.crearNotificacionTiempoReal(
      adminId,
      'Orden Trabajo',
      orden.maquinaria_id_maquina,
      orden.modelo_equipo,
      prioridad,
      diasAtraso * 24 * -1,
      {
        tipo_evento: 'Retraso en mantenimiento',
        id_orden: orden.id_orden,
        fecha_programada: orden.fecha_programada,
        dias_atraso: diasAtraso,
        mecanico_asignado: orden.mecanico_asignado,
        mecanico_nombre: orden.mecanico_nombre,
        estado_ot: orden.estado_ot,
        timestamp: new Date().toISOString(),
      }
    );

    if (io) {
      enviarNotificacionAAdministradores(io, {
        tipo: 'Orden Trabajo',
        maquina_id: orden.maquinaria_id_maquina,
        nombre_maquina: orden.modelo_equipo,
        prioridad,
        horas_restantes: diasAtraso * 24 * -1,
        mensaje,
        timestamp: new Date().toISOString(),
        referencia_sistema: 'SIS-16',
        dias_atraso: diasAtraso,
        mecanico_asignado: orden.mecanico_nombre,
      });
    }

    await mantenimientosRepo.marcarRetrasoNotificado(orden.id_orden);
    notificadas.push(orden.id_orden);
  }

  return successPayload({
    cantidad_detectadas: ordenes.length,
    cantidad_notificadas: notificadas.length,
    ids_notificados: notificadas,
  });
}

module.exports = {
  create,
  listByMaquina,
  historialByMaquina,
  tiposServicio,
  programar,
  listOrdenes,
  listOrdenesMaquina,
  listOrdenesMecanico,
  iniciar,
  getOrdenById,
  eliminarOrden,
  completar,
  listOrdenesAtrasadas,
  verificarRetrasos,
  procesarRetrasos
};
