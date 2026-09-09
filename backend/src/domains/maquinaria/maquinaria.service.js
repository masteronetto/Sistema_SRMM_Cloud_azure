import * as repository from './maquinaria.repository.js';
import { toMaquinariaDto, toMaquinariaInput } from './maquinaria.dto.js';
import { validateMaquinaria } from './maquinaria.validation.js';

function assertValid(input) {
  const errors = validateMaquinaria(input);
  if (Object.keys(errors).length) {
    const error = new Error('Los datos de maquinaria no son validos.');
    error.statusCode = 422;
    error.details = errors;
    throw error;
  }
}

export async function listar() {
  const rows = await repository.listMaquinaria();
  return rows.map(toMaquinariaDto);
}

export async function crear(body) {
  const input = toMaquinariaInput(body);
  assertValid(input);
  return toMaquinariaDto(await repository.createMaquinaria(input));
}

export async function actualizar(id, body) {
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId < 1) {
    const error = new Error('El id de maquinaria no es valido.');
    error.statusCode = 422;
    throw error;
  }
  const input = toMaquinariaInput(body);
  assertValid(input);
  const updated = await repository.updateMaquinaria(numericId, input);
  if (!updated) {
    const error = new Error('Maquinaria no encontrada.');
    error.statusCode = 404;
    throw error;
  }
  return toMaquinariaDto(updated);
}
