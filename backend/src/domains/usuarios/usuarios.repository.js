import { requireDatabase } from '../../db/pool.js';

export async function listUsuarios() {
  const result = await requireDatabase().query(`
    SELECT oid, nombre, correo, ultimo_acceso, creado_en
    FROM identidad_usuario
    ORDER BY creado_en DESC, nombre ASC
  `);

  return result.rows;
}

export async function getUsuarioByOid(oid) {
  const result = await requireDatabase().query(`
    SELECT oid, nombre, correo, ultimo_acceso, creado_en
    FROM identidad_usuario
    WHERE oid = $1
    LIMIT 1
  `, [oid]);

  return result.rows[0] || null;
}

export async function createUsuario(input) {
  const result = await requireDatabase().query(`
    INSERT INTO identidad_usuario (oid, nombre, correo)
    VALUES ($1, $2, $3)
    ON CONFLICT (oid) DO UPDATE
      SET nombre = EXCLUDED.nombre,
          correo = EXCLUDED.correo,
          ultimo_acceso = NOW()
    RETURNING oid, nombre, correo, ultimo_acceso, creado_en
  `, [input.oid, input.nombre, input.correo]);

  return result.rows[0] || null;
}

export async function updateUsuario(oid, input) {
  const result = await requireDatabase().query(`
    UPDATE identidad_usuario
    SET nombre = $2,
        correo = $3,
        ultimo_acceso = NOW()
    WHERE oid = $1
    RETURNING oid, nombre, correo, ultimo_acceso, creado_en
  `, [oid, input.nombre, input.correo]);

  return result.rows[0] || null;
}

export async function deleteUsuario(oid) {
  const pool = requireDatabase();
  await pool.query('BEGIN');
  try {
    await pool.query(`DELETE FROM mantenimiento WHERE usuarios_id_usuario = $1`, [oid]);
    await pool.query(`DELETE FROM incidencias_maquina WHERE operador_id = $1`, [oid]);
    await pool.query(`DELETE FROM historial_horometro WHERE id_usuario = $1`, [oid]);

    const result = await pool.query(`
      DELETE FROM identidad_usuario
      WHERE oid = $1
      RETURNING oid
    `, [oid]);

    await pool.query('COMMIT');
    return result.rows[0] || null;
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  }
}
