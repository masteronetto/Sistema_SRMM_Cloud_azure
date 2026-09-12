import { requireDatabase } from '../../db/pool.js';

export async function listArriendos() {
  const result = await requireDatabase().query(`
    SELECT
      a.id_contrato,
      a.maquinaria_id_maquina,
      m.modelo_equipo,
      a.cliente_id,
      iu.nombre AS cliente_nombre,
      a.fecha_inicio,
      a.fecha_fin,
      a.estado_contrato
    FROM arriendos a
    LEFT JOIN maquinaria m ON m.id = a.maquinaria_id_maquina
    LEFT JOIN identidad_usuario iu ON iu.oid = a.cliente_id
    ORDER BY a.id_contrato DESC
  `);
  return result.rows;
}

export async function listArriendosByCliente(clienteId) {
  const result = await requireDatabase().query(`
    SELECT
      a.id_contrato,
      a.maquinaria_id_maquina,
      m.modelo_equipo,
      a.cliente_id,
      iu.nombre AS cliente_nombre,
      a.fecha_inicio,
      a.fecha_fin,
      a.estado_contrato
    FROM arriendos a
    LEFT JOIN maquinaria m ON m.id = a.maquinaria_id_maquina
    LEFT JOIN identidad_usuario iu ON iu.oid = a.cliente_id
    WHERE a.cliente_id = $1
      AND a.estado_contrato = 'Activo'
    ORDER BY a.id_contrato DESC
  `, [clienteId]);
  return result.rows;
}

export async function getArriendoById(id) {
  const result = await requireDatabase().query(`
    SELECT
      a.id_contrato,
      a.maquinaria_id_maquina,
      m.modelo_equipo,
      a.cliente_id,
      iu.nombre AS cliente_nombre,
      a.fecha_inicio,
      a.fecha_fin,
      a.estado_contrato
    FROM arriendos a
    LEFT JOIN maquinaria m ON m.id = a.maquinaria_id_maquina
    LEFT JOIN identidad_usuario iu ON iu.oid = a.cliente_id
    WHERE a.id_contrato = $1
    LIMIT 1
  `, [id]);
  return result.rows[0] || null;
}

export async function getArriendoActivoByMaquina(maquinariaId) {
  const result = await requireDatabase().query(`
    SELECT
      a.id_contrato,
      a.maquinaria_id_maquina,
      a.cliente_id,
      a.estado_contrato,
      a.fecha_inicio,
      a.fecha_fin
    FROM arriendos a
    WHERE a.maquinaria_id_maquina = $1
      AND a.estado_contrato = 'Activo'
    ORDER BY a.id_contrato DESC
    LIMIT 1
  `, [maquinariaId]);
  return result.rows[0] || null;
}

export async function createArriendo(input) {
  const result = await requireDatabase().query(`
    INSERT INTO arriendos (
      maquinaria_id_maquina,
      cliente_id,
      fecha_inicio,
      fecha_fin,
      estado_contrato
    ) VALUES ($1, $2, COALESCE($3, CURRENT_DATE), $4, COALESCE($5, 'Activo'))
    RETURNING id_contrato, maquinaria_id_maquina, cliente_id, fecha_inicio, fecha_fin, estado_contrato
  `, [
    input.maquinaria_id_maquina,
    input.cliente_id,
    input.fecha_inicio ?? null,
    input.fecha_fin ?? null,
    input.estado_contrato ?? 'Activo'
  ]);
  return result.rows[0] || null;
}

export async function deleteArriendo(id) {
  const result = await requireDatabase().query(`
    DELETE FROM arriendos WHERE id_contrato = $1 RETURNING id_contrato
  `, [id]);
  return result.rows[0] || null;
}
