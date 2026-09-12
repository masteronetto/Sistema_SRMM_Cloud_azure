export function toEstadisticasDto(rows = []) {
  return rows.map((row) => ({
    id_maquina: row.id_maquina ?? row.id,
    modelo_equipo: row.modelo_equipo,
    horometro_actual: Number(row.horometro_actual ?? 0),
    total_mantenciones: Number(row.total_mantenciones ?? 0),
    total_fallas: Number(row.total_fallas ?? 0)
  }));
}

export function toTopMaquinasDto(rows = []) {
  return rows.map((row) => ({
    id_maquina: row.id_maquina ?? row.id,
    modelo_equipo: row.modelo_equipo,
    horometro_actual: Number(row.horometro_actual ?? 0),
    estado: row.estado || 'Disponible'
  }));
}

export function toAutoresDto(rows = []) {
  return rows.map((row) => ({
    oid: row.oid,
    nombre: row.nombre,
    correo: row.correo,
    ultimo_acceso: row.ultimo_acceso
  }));
}

export function toUsoHistoricoDto(rows = []) {
  return rows.map((row) => ({
    fecha_registro: row.fecha_registro,
    valor_horas: Number(row.valor_horas ?? 0)
  }));
}

export function toIngresosDto(rows = []) {
  return {
    by_maquina: rows.map((row) => ({
      id_maquina: row.id_maquina ?? row.id,
      modelo_equipo: row.modelo_equipo,
      contratos: Number(row.contratos ?? 0),
      ingresos: Number(row.ingresos ?? 0)
    }))
  };
}
