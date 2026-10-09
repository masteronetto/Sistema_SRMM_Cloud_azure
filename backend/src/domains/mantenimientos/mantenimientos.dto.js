export function toMantenimientoDto(row = {}) {
  return {
    id_mantencion: row.id_mantencion ?? null,
    tipo_servicio: row.tipo_servicio ?? '',
    horometro_registro: row.horometro_registro != null ? Number(row.horometro_registro) : null,
    detalle_tecnico: row.detalle_tecnico ?? '',
    fecha_servicio: row.fecha_servicio ?? null,
    maquinaria_id_maquina: row.maquinaria_id_maquina ?? null,
    maquinaria_modelo: row.maquinaria_modelo ?? null,
    usuarios_id_usuario: row.usuarios_id_usuario ?? null,
    usuario_nombre: row.usuario_nombre ?? null,
    arriendos_id_contrato: row.arriendos_id_contrato ?? null,
    created_at: row.created_at ?? null
  };
}

export function toTipoServicioDto(rows = []) {
  return rows.map((row) => row.tipo_servicio ?? row);
}

export function toHistorialMantencionesDto(rows = []) {
  return (rows || []).map((row) => ({
    id_registro: row.id_registro ?? row.id_mantencion ?? null,
    fecha_registro: row.fecha_servicio ?? row.fecha_registro ?? null,
    modelo_equipo: row.modelo_equipo ?? row.maquinaria_modelo ?? null,
    tipo_servicio: row.tipo_servicio ?? 'Servicio',
    valor_horas: row.horometro_registro != null ? Number(row.horometro_registro) : 0,
    id_usuario: row.usuarios_id_usuario ?? row.id_usuario ?? null,
    arriendos_id_contrato: row.arriendos_id_contrato ?? null,
    maquinaria_id_maquina: row.maquinaria_id_maquina ?? null,
    detalle_tecnico: row.detalle_tecnico ?? '',
    created_at: row.created_at ?? null
  }));
}

export function toIncidenciaInput(payload = {}, operadorId) {
  return {
    maquinaria_id_maquina: Number(payload.maquinaria_id_maquina),
    operador_id: String(operadorId || payload.operador_id || '').trim(),
    descripcion: String(payload.descripcion || '').trim(),
    criticidad: String(payload.criticidad || 'Media').trim(),
    estado: String(payload.estado || 'Pendiente').trim()
  };
}

export function toIncidenciaDto(row = {}) {
  return {
    id_incidencia: row.id_incidencia ?? null,
    maquinaria_id_maquina: row.maquinaria_id_maquina ?? null,
    operador_id: row.operador_id ?? null,
    descripcion: row.descripcion ?? '',
    criticidad: row.criticidad ?? 'Media',
    estado: row.estado ?? 'Pendiente',
    fecha: row.fecha ?? null,
    created_at: row.created_at ?? null
  };
}
