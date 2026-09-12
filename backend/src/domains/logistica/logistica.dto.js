export function toLogisticaDto(row = null) {
  if (!row) return null;

  return {
    id_evento: row.id_evento,
    maquinaria_id_maquina: row.maquinaria_id_maquina ?? null,
    maquinaria_modelo: row.maquinaria_modelo ?? null,
    arriendos_id_contrato: row.arriendos_id_contrato ?? null,
    arriendo_estado: row.arriendo_estado ?? null,
    titulo: row.titulo ?? '',
    equipo: row.equipo ?? '',
    cliente: row.cliente ?? '',
    ruta: row.ruta ?? '',
    hora_evento: row.hora_evento ?? null,
    estado_evento: row.estado_evento ?? 'Pendiente',
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null
  };
}

export function toLogisticaInput(payload = {}) {
  return {
    titulo: String(payload.titulo || '').trim(),
    equipo: String(payload.equipo || '').trim(),
    cliente: String(payload.cliente || '').trim(),
    ruta: String(payload.ruta || '').trim(),
    hora_evento: String(payload.hora_evento || '').trim(),
    estado_evento: String(payload.estado_evento || 'Pendiente').trim(),
    maquinaria_id_maquina: payload.maquinaria_id_maquina === undefined || payload.maquinaria_id_maquina === null || payload.maquinaria_id_maquina === ''
      ? null
      : Number(payload.maquinaria_id_maquina),
    arriendos_id_contrato: payload.arriendos_id_contrato === undefined || payload.arriendos_id_contrato === null || payload.arriendos_id_contrato === ''
      ? null
      : Number(payload.arriendos_id_contrato)
  };
}
