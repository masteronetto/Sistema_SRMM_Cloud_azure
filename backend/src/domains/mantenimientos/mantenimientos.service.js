import * as repository from './mantenimientos.repository.js';
import { toHistorialMantencionesDto, toMantenimientoDto, toTipoServicioDto, toIncidenciaInput, toIncidenciaDto } from './mantenimientos.dto.js';
import { publishCriticalMaintenanceIncident } from '../../messaging/rabbit.publisher.js';

export async function tiposServicio() {
  const rows = await repository.listTiposServicio();
  return toTipoServicioDto(rows);
}

export async function historialMaquina(idMaquina, filtros = {}) {
  const numericId = Number(idMaquina);
  if (!Number.isInteger(numericId) || numericId < 1) {
    const error = new Error('El id de maquinaria no es valido.');
    error.statusCode = 422;
    throw error;
  }

  const response = await repository.listHistorialMantencionesByMaquina(numericId, filtros);
  return {
    total: response.total,
    data: toHistorialMantencionesDto(response.rows)
  };
}

export async function crearMantenimiento(payload) {
  return toMantenimientoDto(payload);
}

export async function crearIncidencia(payload, operadorId) {
  const input = toIncidenciaInput(payload, operadorId);
  const errors = [];
  if (!Number.isInteger(input.maquinaria_id_maquina) || input.maquinaria_id_maquina < 1) {
    errors.push('maquinaria_id_maquina debe ser un id valido.');
  }
  if (!input.operador_id) errors.push('operador_id es obligatorio.');
  if (!input.descripcion) errors.push('descripcion es obligatoria.');
  if (!['Alta', 'Media', 'Baja'].includes(input.criticidad)) {
    errors.push('criticidad es invalida.');
  }
  if (!['Pendiente', 'Resuelta'].includes(input.estado)) {
    errors.push('estado es invalido.');
  }
  if (errors.length) {
    const error = new Error('Los datos de la incidencia no son validos.');
    error.statusCode = 422;
    error.details = errors;
    throw error;
  }

  const created = await repository.createIncidencia(input);
  const response = toIncidenciaDto(created);
  if (response.criticidad === 'Alta') {
    await publishCriticalMaintenanceIncident(response);
  }
  return response;
}
