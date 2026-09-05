const pool = require('../../db/pool');

async function registrarIncidencia(id_maquina, id_usuario, descripcion, criticidad, orden_trabajo_id = null) {
    const queryAnalisis = `
        SELECT 
            m.horometro_actual,
            p.intervalo_horas,
            COALESCE(
                (SELECT horometro_registro FROM mantenimiento 
                 WHERE maquinaria_id_maquina = $1 
                 ORDER BY fecha_servicio DESC LIMIT 1), 
            0) as ultimo_mantenimiento
        FROM maquinaria m
        LEFT JOIN planes_mantencion p ON m.planes_mantencion_id_plan = p.id_plan
        WHERE m.id_maquina = $1
    `;

    const { rows } = await pool.query(queryAnalisis, [id_maquina]);
    const maquinaInfo = rows[0];

    if (!maquinaInfo) {
        throw new Error('Maquinaria no encontrada');
    }

    const intervaloHoras = Number(maquinaInfo.intervalo_horas || 0);
    const limiteSeguro = Number(maquinaInfo.ultimo_mantenimiento || 0) + intervaloHoras;
    const horasExcedidas = intervaloHoras > 0 ? (Number(maquinaInfo.horometro_actual || 0) - limiteSeguro) : 0;

    let vinculada = 0;
    let advertencia = null;

    if (horasExcedidas > 0) {
        vinculada = 1;
        advertencia = `⚠️ Advertencia: Esta falla ocurrió ${horasExcedidas} horas después del mantenimiento vencido.`;
    }

    const insertQuery = `
        INSERT INTO incidencias_maquina 
        (maquinaria_id_maquina, operador_id, fecha, descripcion, criticidad, vinculada_mantenimiento, orden_trabajo_id, estado)
        VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6, 'Pendiente')
        RETURNING *
    `;

    const nuevaIncidencia = await pool.query(insertQuery, [
        id_maquina,
        id_usuario,
        descripcion,
        criticidad,
        vinculada,
        orden_trabajo_id
    ]);

    return {
        incidencia: nuevaIncidencia.rows[0],
        mensaje_advertencia: advertencia
    };
}

async function listIncidencias({ maquinaria_ids = [], fecha_inicio = null, fecha_fin = null, criticidad = null, solo_no_resueltas = false, operador_id = null } = {}) {
    const conditions = [];
    const values = [];
    let idx = 1;

    if (Array.isArray(maquinaria_ids) && maquinaria_ids.length > 0) {
        conditions.push(`i.maquinaria_id_maquina = ANY($${idx}::bigint[])`);
        values.push(maquinaria_ids.map((v) => Number(v)).filter((v) => Number.isFinite(v)));
        idx += 1;
    }

    if (fecha_inicio) {
        conditions.push(`i.fecha >= $${idx}`);
        values.push(fecha_inicio);
        idx += 1;
    }

    if (fecha_fin) {
        conditions.push(`i.fecha <= $${idx}`);
        values.push(fecha_fin);
        idx += 1;
    }

    if (criticidad) {
        conditions.push(`i.criticidad = $${idx}`);
        values.push(criticidad);
        idx += 1;
    }

    if (operador_id !== null && operador_id !== undefined) {
        conditions.push(`i.operador_id = $${idx}`);
        values.push(Number(operador_id));
        idx += 1;
    }

    if (solo_no_resueltas) {
        conditions.push(`i.estado = 'Pendiente'`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
        SELECT
            i.id_incidencia,
            i.maquinaria_id_maquina,
            m.modelo_equipo,
            i.fecha,
            i.descripcion,
            i.criticidad,
            i.vinculada_mantenimiento,
            i.mantenimiento_id,
            i.orden_trabajo_id,
            i.estado,
            i.operador_id,
            u.nombre_completo as operador_nombre
        FROM incidencias_maquina i
        LEFT JOIN maquinaria m ON m.id_maquina = i.maquinaria_id_maquina
        LEFT JOIN usuarios u ON u.id_usuario = i.operador_id
        ${whereClause}
        ORDER BY i.fecha DESC, i.id_incidencia DESC
    `;

    const { rows } = await pool.query(query, values);
    return rows;
}

async function getIncidenciaById(id_incidencia) {
    const query = `
        SELECT
            i.id_incidencia,
            i.maquinaria_id_maquina,
            i.fecha,
            i.descripcion,
            i.criticidad,
            i.vinculada_mantenimiento,
            i.mantenimiento_id,
            i.orden_trabajo_id,
            i.estado,
            i.operador_id,
            i.created_at,
            i.updated_at
        FROM incidencias_maquina i
        WHERE i.id_incidencia = $1
        LIMIT 1
    `;

    const { rows } = await pool.query(query, [id_incidencia]);
    return rows[0] || null;
}

async function resolverIncidencia(id_incidencia) {
    const query = `
        UPDATE incidencias_maquina
        SET estado = 'Resuelta',
            updated_at = NOW()
        WHERE id_incidencia = $1
        RETURNING id_incidencia, maquinaria_id_maquina, operador_id, fecha, descripcion, criticidad, vinculada_mantenimiento, mantenimiento_id, orden_trabajo_id, estado, created_at, updated_at
    `;

    const { rows } = await pool.query(query, [id_incidencia]);
    return rows[0] || null;
}

module.exports = {
    registrarIncidencia,
    listIncidencias,
    getIncidenciaById,
    resolverIncidencia
};