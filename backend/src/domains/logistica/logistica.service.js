import * as repository from './logistica.repository.js';
import { toLogisticaDto, toLogisticaInput } from './logistica.dto.js';

const allowedStates = new Set(['Pendiente', 'Confirmado', 'En Ruta', 'Completado', 'Cancelado']);

function assertValid(input) {
  const errors = [];
  if (!input.titulo) errors.push('titulo es obligatorio.');
  if (!input.equipo) errors.push('equipo es obligatorio.');
  if (!input.ruta) errors.push('ruta es obligatorio.');
  if (!input.hora_evento) errors.push('hora_evento es obligatorio.');
  if (!input.cliente && input.arriendos_id_contrato === null) errors.push('cliente es obligatorio si no asocias un arriendo.');
  if (input.maquinaria_id_maquina !== null && (!Number.isInteger(input.maquinaria_id_maquina) || input.maquinaria_id_maquina < 1)) {
    errors.push('maquinaria_id_maquina debe ser un numero positivo.');
  }
  if (input.arriendos_id_contrato !== null && (!Number.isInteger(input.arriendos_id_contrato) || input.arriendos_id_contrato < 1)) {
    errors.push('arriendos_id_contrato debe ser un numero positivo.');
  }
  if (!allowedStates.has(input.estado_evento || 'Pendiente')) {
    errors.push('estado_evento es invalido.');
  }

  if (errors.length) {
    const error = new Error('Los datos del evento de logistica no son validos.');
    error.statusCode = 422;
    error.details = errors;
    throw error;
  }
}

export async function listar({ maquinariaIds = [] } = {}) {
  const rows = await repository.listEventos({ maquinariaIds });
  return rows.map(toLogisticaDto);
}

export async function crear(payload) {
  const input = toLogisticaInput(payload);
  assertValid(input);
  const created = await repository.createEvento(input);
  return toLogisticaDto(created);
}

export async function actualizar(id_evento, payload) {
  const numericId = Number(id_evento);
  if (!Number.isInteger(numericId) || numericId < 1) {
    const error = new Error('id_evento debe ser numerico.');
    error.statusCode = 422;
    throw error;
  }

  const input = toLogisticaInput(payload);
  assertValid(input);
  const updated = await repository.updateEvento(numericId, input);
  if (!updated) {
    const error = new Error('Evento no encontrado.');
    error.statusCode = 404;
    throw error;
  }

  return toLogisticaDto(updated);
}

export async function eliminar(id_evento) {
  const numericId = Number(id_evento);
  if (!Number.isInteger(numericId) || numericId < 1) {
    const error = new Error('id_evento debe ser numerico.');
    error.statusCode = 422;
    throw error;
  }

  const deleted = await repository.deleteEvento(numericId);
  if (!deleted) {
    const error = new Error('Evento no encontrado.');
    error.statusCode = 404;
    throw error;
  }

  return { id_evento: numericId };
}
