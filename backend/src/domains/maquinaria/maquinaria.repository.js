import { requireDatabase } from '../../db/pool.js';

const columns = 'id, modelo_equipo, horometro_actual, estado, especificaciones, plan_mantenimiento_id, tarifa_diaria, creado_en, actualizado_en';

export async function listMaquinaria() {
  const result = await requireDatabase().query(`SELECT ${columns} FROM maquinaria ORDER BY id DESC`);
  return result.rows;
}

export async function createMaquinaria(input) {
  const result = await requireDatabase().query(
    `INSERT INTO maquinaria (modelo_equipo, horometro_actual, estado, especificaciones, plan_mantenimiento_id, tarifa_diaria)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${columns}`,
    [input.modelo_equipo, input.horometro_actual, input.estado, input.especificaciones, input.plan_mantenimiento_id, input.tarifa_diaria]
  );
  return result.rows[0];
}

export async function updateMaquinaria(id, input) {
  const result = await requireDatabase().query(
    `UPDATE maquinaria
     SET modelo_equipo = $1, horometro_actual = $2, estado = $3, especificaciones = $4,
         plan_mantenimiento_id = $5, tarifa_diaria = $6, actualizado_en = NOW()
     WHERE id = $7 RETURNING ${columns}`,
    [input.modelo_equipo, input.horometro_actual, input.estado, input.especificaciones, input.plan_mantenimiento_id, input.tarifa_diaria, id]
  );
  return result.rows[0] || null;
}
