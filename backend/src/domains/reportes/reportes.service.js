import * as repository from './reportes.repository.js';
import {
  toEstadisticasDto,
  toTopMaquinasDto,
  toAutoresDto,
  toUsoHistoricoDto,
  toIngresosDto
} from './reportes.dto.js';

export async function estadisticas() {
  const rows = await repository.listEstadisticas();
  return toEstadisticasDto(rows);
}

export async function topMaquinas() {
  const rows = await repository.listTopMaquinas();
  return toTopMaquinasDto(rows);
}

export async function autores({ fecha_inicio, fecha_fin } = {}) {
  const rows = await repository.listAutores({ fecha_inicio, fecha_fin });
  return toAutoresDto(rows);
}

export async function usoHistorico(idMaquina) {
  const numericId = Number(idMaquina);
  if (!Number.isInteger(numericId) || numericId < 1) {
    const error = new Error('El id de maquinaria no es valido.');
    error.statusCode = 422;
    throw error;
  }

  const rows = await repository.listUsoHistorico(numericId);
  return toUsoHistoricoDto(rows);
}

export async function ingresos({ fecha_inicio, fecha_fin } = {}) {
  const rows = await repository.listIngresos({ fecha_inicio, fecha_fin });
  return toIngresosDto(rows);
}
