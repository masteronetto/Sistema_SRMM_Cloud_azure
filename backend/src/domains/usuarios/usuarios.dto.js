export function toUsuarioDto(row = null) {
  if (!row) return null;

  return {
    oid: row.oid ?? '',
    nombre: row.nombre ?? '',
    correo: row.correo ?? '',
    ultimo_acceso: row.ultimo_acceso ?? null,
    creado_en: row.creado_en ?? null
  };
}

export function toUsuarioInput(payload = {}) {
  return {
    oid: String(payload.oid ?? '').trim(),
    nombre: String(payload.nombre ?? '').trim(),
    correo: String(payload.correo ?? '').trim()
  };
}
