export function toMaquinariaDto(row) {
  if (!row) return null;
  return {
    id_maquina: row.id_maquina ?? row.id,
    modelo_equipo: row.modelo_equipo,
    horometro_actual: Number(row.horometro_actual),
    estado: row.estado,
    especificaciones: row.especificaciones,
    planes_mantencion_id_plan: row.plan_mantenimiento_id ?? null,
    tarifa_diaria: row.tarifa_diaria === null || row.tarifa_diaria === undefined ? null : Number(row.tarifa_diaria),
    created_at: row.creado_en,
    updated_at: row.actualizado_en
  };
}

export function toMaquinariaInput(body = {}) {
  return {
    modelo_equipo: String(body.modelo_equipo ?? '').trim(),
    horometro_actual: body.horometro_actual === '' || body.horometro_actual === undefined ? 0 : Number(body.horometro_actual),
    estado: body.estado || 'Disponible',
    especificaciones: body.especificaciones ? String(body.especificaciones).trim() : null,
    plan_mantenimiento_id: body.planes_mantencion_id_plan === '' || body.planes_mantencion_id_plan === undefined || body.planes_mantencion_id_plan === null ? null : Number(body.planes_mantencion_id_plan),
    tarifa_diaria: body.tarifa_diaria === '' || body.tarifa_diaria === undefined || body.tarifa_diaria === null ? null : Number(body.tarifa_diaria)
  };
}
