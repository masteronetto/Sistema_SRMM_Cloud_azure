import * as repository from './mantenimientos.repository.js';
import { toHistorialMantencionesDto, toMantenimientoDto, toTipoServicioDto } from './mantenimientos.dto.js';

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
