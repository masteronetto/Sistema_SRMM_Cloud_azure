export function toArriendoDto(row = null) {
  if (!row) return null;

  return {
    id_contrato: row.id_contrato,
    maquinaria_id_maquina: row.maquinaria_id_maquina ?? null,
    modelo_equipo: row.modelo_equipo ?? null,
    cliente_id: row.cliente_id ?? null,
    cliente_nombre: row.cliente_nombre ?? row.nombre ?? null,
    horometro_entrada: row.horometro_entrada === null || row.horometro_entrada === undefined
      ? null
      : Number(row.horometro_entrada),
    horometro_salida: row.horometro_salida === null || row.horometro_salida === undefined
      ? null
      : Number(row.horometro_salida),
    fecha_inicio: row.fecha_inicio ?? null,
    fecha_fin: row.fecha_fin ?? null,
    estado_contrato: row.estado_contrato ?? 'Activo'
  };
}

export function toArriendoInput(body = {}) {
  return {
    maquinaria_id_maquina: body.maquinaria_id_maquina === '' || body.maquinaria_id_maquina === undefined || body.maquinaria_id_maquina === null
      ? null
      : Number(body.maquinaria_id_maquina),
    cliente_id: body.cliente_id === '' || body.cliente_id === undefined || body.cliente_id === null
      ? null
      : String(body.cliente_id),
    horometro_entrada: body.horometro_entrada === '' || body.horometro_entrada === undefined || body.horometro_entrada === null
      ? null
      : Number(body.horometro_entrada),
    horometro_salida: body.horometro_salida === '' || body.horometro_salida === undefined || body.horometro_salida === null
      ? null
      : Number(body.horometro_salida),
    fecha_inicio: body.fecha_inicio || null,
    fecha_fin: body.fecha_fin || null,
    estado_contrato: body.estado_contrato || 'Activo'
  };
}
