import * as repository from './arriendos.repository.js';
import { toArriendoDto, toArriendoInput } from './arriendos.dto.js';

export function normalizeClienteId(value) {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return null;
  }

  const raw = String(value).trim();
  if (!raw) {
    return null;
  }

  if (/^\d+$/.test(raw)) {
    return Number(raw);
  }

  return raw;
}

function assertValid(input) {
  const errors = [];
  if (!input.maquinaria_id_maquina || !Number.isInteger(input.maquinaria_id_maquina) || input.maquinaria_id_maquina < 1) {
    errors.push('maquinaria_id_maquina debe ser un id valido.');
  }
  if (!input.cliente_id) {
    errors.push('cliente_id es obligatorio.');
  }
  if (!input.fecha_inicio) {
    errors.push('fecha_inicio es obligatorio.');
  }

  if (errors.length) {
    const error = new Error('Los datos del arriendo no son validos.');
    error.statusCode = 422;
    error.details = errors;
    throw error;
  }
}

export async function listar() {
  const rows = await repository.listArriendos();
  return rows.map(toArriendoDto);
}

export async function misContratos(clienteId) {
  const normalized = normalizeClienteId(clienteId);
  if (!normalized || (typeof normalized === 'number' && (!Number.isInteger(normalized) || normalized < 1))) {
    const error = new Error('El cliente no es valido.');
    error.statusCode = 422;
    throw error;
  }

  const rows = await repository.listArriendosByCliente(normalized);
  return rows.map(toArriendoDto);
}

export async function crear(body) {
  const input = toArriendoInput(body);
  assertValid(input);

  const created = await repository.createArriendo(input);
  return toArriendoDto(created);
}

export async function eliminar(id) {
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId < 1) {
    const error = new Error('El id_contrato no es valido.');
    error.statusCode = 422;
    throw error;
  }

  const deleted = await repository.deleteArriendo(numericId);
  if (!deleted) {
    const error = new Error('Contrato no encontrado.');
    error.statusCode = 404;
    throw error;
  }

  return { id_contrato: numericId };
}
