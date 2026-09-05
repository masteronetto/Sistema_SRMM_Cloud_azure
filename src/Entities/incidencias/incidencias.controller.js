const incidenciasRepository = require('./incidencias.repository');
const mantenimientosRepo = require('../mantenimientos/mantenimientos.repository');

async function crearIncidencia(req, res) {
    try {
        const { id_maquina, id_usuario: bodyUsuarioId, descripcion, criticidad, orden_trabajo_id } = req.body;
        const descripcionNormalizada = String(descripcion || '').trim();
        const authenticatedUserId = Number(req.user?.id_usuario);
        const role = req.user?.rol_acceso;
        const id_usuario = role === 'Operador'
            ? authenticatedUserId
            : (bodyUsuarioId && Number.isFinite(Number(bodyUsuarioId)) ? Number(bodyUsuarioId) : authenticatedUserId);

        // Validación básica de seguridad de datos entrantes
        if (!id_maquina || !id_usuario || !descripcionNormalizada || !criticidad) {
            return res.status(400).json({ error: 'Faltan campos obligatorios.' });
        }

        if (descripcionNormalizada.length < 10) {
            return res.status(400).json({ error: 'La descripción debe tener al menos 10 caracteres.' });
        }

        if (orden_trabajo_id !== undefined && orden_trabajo_id !== null && String(orden_trabajo_id).trim() !== '') {
            const ordenTrabajoId = Number(orden_trabajo_id);
            if (!Number.isFinite(ordenTrabajoId) || ordenTrabajoId <= 0) {
                return res.status(400).json({ error: 'orden_trabajo_id debe ser numérico' });
            }

            const ordenTrabajo = await mantenimientosRepo.getOrdenTrabajoById(ordenTrabajoId);
            if (!ordenTrabajo) {
                return res.status(404).json({ error: 'orden_trabajo_id no corresponde a una orden existente' });
            }
        }

        // Llamamos al repositorio que creamos en el paso anterior para procesar la regla del horómetro
        const resultado = await incidenciasRepository.registrarIncidencia(
            id_maquina,
            id_usuario,
            descripcionNormalizada,
            criticidad,
            orden_trabajo_id && Number.isFinite(Number(orden_trabajo_id)) ? Number(orden_trabajo_id) : null
        );

        // Devolvemos un código 201 (Creado) junto con la alerta si el mantenimiento estaba vencido
        return res.status(201).json({
            success: true,
            incidencia: resultado.incidencia,
            advertencia: resultado.mensaje_advertencia // El Frontend leerá esto para pintar la alerta roja
        });

    } catch (error) {
        console.error('Error en incidencias.controller:', error);
        return res.status(500).json({ error: 'Error interno del servidor al registrar la incidencia.' });
    }
}

async function listarIncidencias(req, res, next) {
    try {
        const maquinaIds = typeof req.query.maquina_ids === 'string' && req.query.maquina_ids.trim() !== ''
            ? req.query.maquina_ids.split(',').map((v) => Number(v.trim())).filter((v) => Number.isFinite(v))
            : [];
        const fechaInicio = typeof req.query.fecha_inicio === 'string' && req.query.fecha_inicio.trim() !== '' ? req.query.fecha_inicio.trim() : null;
        const fechaFin = typeof req.query.fecha_fin === 'string' && req.query.fecha_fin.trim() !== '' ? req.query.fecha_fin.trim() : null;
        const criticidad = typeof req.query.criticidad === 'string' && req.query.criticidad.trim() !== '' ? req.query.criticidad.trim() : null;
        const soloNoResueltas = req.query.solo_no_resueltas === 'true' || req.query.solo_no_resueltas === '1';
        const role = req.user?.rol_acceso;
        const operadorId = Number(req.user?.id_usuario);

        const rows = await incidenciasRepository.listIncidencias({
            maquinaria_ids: maquinaIds,
            fecha_inicio: fechaInicio,
            fecha_fin: fechaFin,
            criticidad,
            solo_no_resueltas: soloNoResueltas,
            operador_id: role === 'Operador' && Number.isFinite(operadorId) ? operadorId : null
        });
        return res.json(rows);
    } catch (error) {
        return next(error);
    }
}

async function resolverIncidencia(req, res, next) {
    try {
        const idIncidencia = Number(req.params.id_incidencia);
        if (!Number.isFinite(idIncidencia) || idIncidencia <= 0) {
            return res.status(400).json({ message: 'id_incidencia debe ser numérico' });
        }

        const incidenciaActual = await incidenciasRepository.getIncidenciaById(idIncidencia);
        if (!incidenciaActual) {
            return res.status(404).json({ message: 'Incidencia no encontrada' });
        }

        if (String(incidenciaActual.estado || '').toLowerCase() === 'resuelta') {
            return res.status(200).json({
                message: 'La incidencia ya estaba resuelta',
                incidencia: incidenciaActual
            });
        }

        const incidencia = await incidenciasRepository.resolverIncidencia(idIncidencia);
        if (!incidencia) {
            return res.status(404).json({ message: 'Incidencia no encontrada al actualizar' });
        }

        return res.json({
            message: 'Incidencia marcada como resuelta',
            incidencia
        });
    } catch (error) {
        return next(error);
    }
}

module.exports = {
    crearIncidencia,
    listarIncidencias,
    resolverIncidencia
};