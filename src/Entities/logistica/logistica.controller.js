const maquinariaRepo = require('../maquinaria/maquinaria.repository');
const logisticaRepo = require('./logistica.repository');
const arriendosRepo = require('../arriendos/arriendos.repository');
const usuariosRepo = require('../usuarios/usuarios.repository');
const pool = require('../../db/pool');

function validateEventoPayload(payload) {
  const maquinaria_id_maquina = payload.maquinaria_id_maquina === undefined || payload.maquinaria_id_maquina === null || payload.maquinaria_id_maquina === ''
    ? null
    : Number(payload.maquinaria_id_maquina);
  const arriendos_id_contrato = payload.arriendos_id_contrato === undefined || payload.arriendos_id_contrato === null || payload.arriendos_id_contrato === ''
    ? null
    : Number(payload.arriendos_id_contrato);
  const titulo = payload.titulo ? String(payload.titulo).trim() : '';
  const equipo = payload.equipo ? String(payload.equipo).trim() : '';
  const cliente = payload.cliente ? String(payload.cliente).trim() : '';
  const ruta = payload.ruta ? String(payload.ruta).trim() : '';
  const hora_evento = payload.hora_evento ? String(payload.hora_evento).trim() : '';
  const estado_evento = payload.estado_evento ? String(payload.estado_evento).trim() : 'Pendiente';

  const requiereClienteManual = arriendos_id_contrato === null;
  if (!titulo || !equipo || !ruta || !hora_evento || (requiereClienteManual && !cliente)) {
    return { error: 'Campos obligatorios: titulo, equipo, ruta, hora_evento y cliente (si no asocias arriendo)', parsed: null };
  }

  if (maquinaria_id_maquina !== null && !Number.isFinite(maquinaria_id_maquina)) {
    return { error: 'maquinaria_id_maquina debe ser numerico si se envia', parsed: null };
  }

  if (arriendos_id_contrato !== null && !Number.isFinite(arriendos_id_contrato)) {
    return { error: 'arriendos_id_contrato debe ser numerico si se envia', parsed: null };
  }

  return {
    error: null,
    parsed: {
      titulo,
      equipo,
      cliente,
      ruta,
      hora_evento,
      estado_evento,
      maquinaria_id_maquina,
      arriendos_id_contrato
    }
  };
}

async function list(req, res, next) {
  try {
    const maquinariaIds = typeof req.query.maquinaria_ids === 'string' && req.query.maquinaria_ids.trim() !== ''
      ? req.query.maquinaria_ids.split(',').map((value) => Number(value.trim())).filter((value) => Number.isFinite(value) && value > 0)
      : [];

    const rows = await logisticaRepo.listEventos({ maquinariaIds });
    return res.json(rows);
  } catch (error) {
    return next(error);
  }
}

async function create(req, res, next) {
  try {
    const { error, parsed } = validateEventoPayload(req.body);
    if (error) {
      return res.status(400).json({ message: error });
    }

    let resolvedMachineId = parsed.maquinaria_id_maquina;
    let resolvedEquipo = parsed.equipo;
    let resolvedCliente = parsed.cliente;

    if (parsed.arriendos_id_contrato !== null) {
      const contrato = await arriendosRepo.getArriendoById(parsed.arriendos_id_contrato);
      if (!contrato) {
        return res.status(404).json({ message: 'El arriendo asociado no existe' });
      }

      if (String(contrato.estado_contrato || '').toLowerCase() !== 'activo') {
        return res.status(400).json({ message: 'Solo se pueden asociar eventos a contratos de arriendo activos' });
      }

      resolvedMachineId = Number(contrato.maquinaria_id_maquina);

      if (parsed.maquinaria_id_maquina !== null && Number(parsed.maquinaria_id_maquina) !== resolvedMachineId) {
        return res.status(400).json({ message: 'La máquina seleccionada no coincide con la del contrato de arriendo' });
      }

      const maquinariaContrato = await maquinariaRepo.getMaquinariaById(resolvedMachineId);
      if (maquinariaContrato) {
        resolvedEquipo = resolvedEquipo || maquinariaContrato.modelo_equipo || resolvedEquipo;
      }

      if (contrato.cliente_id !== null) {
        const clienteContrato = await usuariosRepo.getUsuarioById(contrato.cliente_id);
        if (clienteContrato) {
          resolvedCliente = resolvedCliente || clienteContrato.nombre_completo || clienteContrato.email || resolvedCliente;
        }
      }
    }

    if (!resolvedEquipo || !resolvedCliente) {
      return res.status(400).json({ message: 'equipo y cliente son obligatorios (directos o desde arriendo asociado)' });
    }

    if (resolvedMachineId !== null) {
      const maquina = await maquinariaRepo.getMaquinariaById(resolvedMachineId);
      if (!maquina) {
        return res.status(404).json({ message: 'La máquina asociada no existe' });
      }
    }

    const evento = await logisticaRepo.createEvento({
      ...parsed,
      maquinaria_id_maquina: resolvedMachineId,
      equipo: resolvedEquipo,
      cliente: resolvedCliente
    });
    return res.status(201).json(evento);
  } catch (error) {
    return next(error);
  }
}

async function remove(req, res, next) {
  try {
    const id_evento = Number(req.params.id_evento);
    if (!Number.isFinite(id_evento)) {
      return res.status(400).json({ message: 'id_evento debe ser numerico' });
    }

    const deleted = await logisticaRepo.deleteEvento(id_evento);
    if (!deleted) {
      return res.status(404).json({ message: 'Evento no encontrado' });
    }

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}

function validateEventoEstado(estado_evento) {
  const allowedStates = new Set(['Pendiente', 'Confirmado', 'En Ruta', 'Completado', 'Cancelado']);
  return estado_evento && allowedStates.has(String(estado_evento).trim());
}

function isRetornoEvent(evento) {
  const normalizedTitle = String(evento?.titulo || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  return normalizedTitle.includes('retorno') || normalizedTitle.includes('devolucion');
}

async function canOperadorManageEvento(req, evento) {
  if (!evento?.maquinaria_id_maquina) {
    return false;
  }

  const operadorId = Number(req.user.id_usuario);
  const contrato = await arriendosRepo.getArriendoActivoByMaquina(evento.maquinaria_id_maquina);
  const asignacion = await maquinariaRepo.getAsignacionActivaByMaquina(evento.maquinaria_id_maquina);

  const autorizadoPorContrato = Boolean(contrato && Number(contrato.cliente_id) === operadorId);
  const autorizadoPorAsignacion = Boolean(asignacion && Number(asignacion.operador_id) === operadorId);
  return autorizadoPorContrato || autorizadoPorAsignacion;
}

async function update(req, res, next) {
  try {
    const id_evento = Number(req.params.id_evento);
    if (!Number.isFinite(id_evento)) {
      return res.status(400).json({ message: 'id_evento debe ser numerico' });
    }

    const estado_evento = req.body.estado_evento ? String(req.body.estado_evento).trim() : '';
    if (!validateEventoEstado(estado_evento)) {
      return res.status(400).json({ message: 'Estado inválido. Valores permitidos: Pendiente, Confirmado, En Ruta, Completado, Cancelado' });
    }

    const evento = await logisticaRepo.getEventoById(id_evento);
    if (!evento) {
      return res.status(404).json({ message: 'Evento no encontrado' });
    }

    if (req.user.rol_acceso === 'Operador') {
      if (!evento.maquinaria_id_maquina) {
        return res.status(403).json({ message: 'No puedes cambiar el estado de un evento no vinculado a una máquina' });
      }

      const autorizado = await canOperadorManageEvento(req, evento);
      if (!autorizado) {
        return res.status(403).json({ message: 'Permisos insuficientes. Solo puedes gestionar eventos de tus máquinas' });
      }

      const currentStatus = String(evento.estado_evento || 'Pendiente').trim();
      const transitions = {
        Pendiente: ['Confirmado'],
        Confirmado: ['En Ruta'],
        'En Ruta': ['Completado'],
        Completado: [],
        Cancelado: []
      };

      const allowed = transitions[currentStatus] || [];
      if (!allowed.includes(estado_evento)) {
        return res.status(403).json({ message: `No puedes cambiar el estado de '${currentStatus}' a '${estado_evento}'` });
      }
    }

    const updated = await logisticaRepo.updateEventoStatus(id_evento, estado_evento);
    if (!updated) {
      return res.status(404).json({ message: 'Evento no encontrado al actualizar' });
    }

    if (estado_evento === 'Completado' && isRetornoEvent(evento)) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        let machineId = Number(evento.maquinaria_id_maquina);
        let contratoId = Number(evento.arriendos_id_contrato);

        if ((!Number.isFinite(contratoId) || contratoId <= 0) && Number.isFinite(machineId) && machineId > 0) {
          const contratoActivo = await arriendosRepo.getArriendoActivoByMaquina(machineId, client);
          if (contratoActivo && Number.isFinite(Number(contratoActivo.id_contrato))) {
            contratoId = Number(contratoActivo.id_contrato);
          }
        }

        if (Number.isFinite(contratoId) && contratoId > 0) {
          const contratoCerrado = await arriendosRepo.markArriendoAsCompleted(contratoId, client);
          if (contratoCerrado && Number.isFinite(Number(contratoCerrado.maquinaria_id_maquina))) {
            machineId = Number(contratoCerrado.maquinaria_id_maquina);
          }
        }

        if (Number.isFinite(machineId) && machineId > 0) {
          await maquinariaRepo.finalizarAsignacionActivaByMaquina(machineId, null, client);
          const arriendoActivo = await arriendosRepo.getArriendoActivoByMaquina(machineId, client);
          if (!arriendoActivo) {
            await maquinariaRepo.markMaquinariaDisponibleSiArrendada(machineId, client);
          }
        }

        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        console.error('[logistica.update] Error liberando máquina tras completar devolución/retorno:', error.message);
        // No bloquear respuesta de logística si falla la liberación de contrato/asignación.
      } finally {
        client.release();
      }
    }

    return res.json(updated);
  } catch (error) {
    return next(error);
  }
}

async function createRetorno(req, res, next) {
  try {
    const id_evento = Number(req.params.id_evento);
    if (!Number.isFinite(id_evento)) {
      return res.status(400).json({ message: 'id_evento debe ser numerico' });
    }

    const evento = await logisticaRepo.getEventoById(id_evento);
    if (!evento) {
      return res.status(404).json({ message: 'Evento no encontrado' });
    }

    const currentStatus = String(evento.estado_evento || '').trim();
    if (currentStatus !== 'Completado') {
      return res.status(400).json({ message: 'Solo se puede crear retorno desde eventos en estado Completado' });
    }

    if (req.user.rol_acceso === 'Operador') {
      const autorizado = await canOperadorManageEvento(req, evento);
      if (!autorizado) {
        return res.status(403).json({ message: 'Permisos insuficientes. Solo puedes crear retorno para tus máquinas' });
      }
    }

    const baseTitle = String(evento.titulo || 'Evento logístico').trim();
    const retornoTitle = baseTitle.toLowerCase().includes('retorno')
      ? baseTitle
      : `Retorno · ${baseTitle}`;

    const existingRetorno = await logisticaRepo.getRetornoSimilar({
      maquinaria_id_maquina: evento.maquinaria_id_maquina || null,
      arriendos_id_contrato: evento.arriendos_id_contrato || null,
      titulo: retornoTitle
    });

    if (existingRetorno) {
      return res.status(409).json({
        message: 'Ya existe un retorno para este evento',
        id_evento_retorno: existingRetorno.id_evento,
        estado_evento_retorno: existingRetorno.estado_evento
      });
    }

    const retorno = await logisticaRepo.createEvento({
      maquinaria_id_maquina: evento.maquinaria_id_maquina || null,
      arriendos_id_contrato: evento.arriendos_id_contrato || null,
      titulo: retornoTitle,
      equipo: evento.equipo || '',
      cliente: evento.cliente || '',
      ruta: evento.ruta || '',
      hora_evento: evento.hora_evento || '09:00 hrs',
      estado_evento: 'Pendiente'
    });

    return res.status(201).json(retorno);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  list,
  create,
  createRetorno,
  update,
  remove
};