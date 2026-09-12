import * as repository from './usuarios.repository.js';
import { toUsuarioDto, toUsuarioInput } from './usuarios.dto.js';

function assertValid(input) {
  const errors = [];
  if (!input.oid) errors.push('oid es obligatorio.');
  if (!input.nombre) errors.push('nombre es obligatorio.');
  if (!input.correo || !input.correo.includes('@')) errors.push('correo es obligatorio y debe tener formato valido.');

  if (errors.length) {
    const error = new Error('Los datos del usuario no son validos.');
    error.statusCode = 422;
    error.details = errors;
    throw error;
  }
}

export async function listar() {
  const rows = await repository.listUsuarios();
  return rows.map(toUsuarioDto);
}

export async function crear(body) {
  const input = toUsuarioInput(body);
  assertValid(input);
  const created = await repository.createUsuario(input);
  return toUsuarioDto(created);
}

export async function actualizar(oid, body) {
  if (!oid || String(oid).trim() === '') {
    const error = new Error('oid es obligatorio.');
    error.statusCode = 422;
    throw error;
  }

  const input = toUsuarioInput(body);
  input.oid = String(oid);
  assertValid(input);

  const updated = await repository.updateUsuario(String(oid), input);
  if (!updated) {
    const error = new Error('Usuario no encontrado.');
    error.statusCode = 404;
    throw error;
  }

  return toUsuarioDto(updated);
}

export async function eliminar(oid) {
  if (!oid || String(oid).trim() === '') {
    const error = new Error('oid es obligatorio.');
    error.statusCode = 422;
    throw error;
  }

  const deleted = await repository.deleteUsuario(String(oid));
  if (!deleted) {
    const error = new Error('Usuario no encontrado.');
    error.statusCode = 404;
    throw error;
  }

  return { oid };
}
