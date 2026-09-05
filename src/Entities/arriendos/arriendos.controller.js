const pool = require('../../db/pool');
const maquinariaRepo = require('../maquinaria/maquinaria.repository');
const usuariosRepo = require('../usuarios/usuarios.repository');
const arriendosRepo = require('./arriendos.repository');

async function createContrato(req, res, next) {
    const client = await pool.connect();
    try {
        const { maquinaria_id_maquina, maquinaria_ids, cliente_id, fecha_inicio, fecha_fin, horometro_entrada, horometro_salida, estado_contrato } = req.body;
        const requestedMachineIds = Array.isArray(maquinaria_ids) && maquinaria_ids.length > 0
            ? maquinaria_ids
            : (maquinaria_id_maquina !== undefined && maquinaria_id_maquina !== null && maquinaria_id_maquina !== '' ? [maquinaria_id_maquina] : []);
        const machineIds = Array.from(new Set(requestedMachineIds.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0)));
        const idCliente = cliente_id === undefined || cliente_id === null || cliente_id === '' ? null : Number(cliente_id);

        if (!machineIds.length) {
            return res.status(400).json({ message: 'maquinaria_id_maquina o maquinaria_ids debe contener al menos una máquina válida' });
        }

        if (idCliente === null) {
            return res.status(400).json({ message: 'cliente_id es obligatorio para crear un arriendo' });
        }

        if (idCliente !== null && !Number.isFinite(idCliente)) {
            return res.status(400).json({ message: 'cliente_id debe ser numerico si se envia' });
        }

        if (idCliente !== null) {
            const usuario = await usuariosRepo.getUsuarioById(idCliente);
            if (!usuario) {
                return res.status(404).json({ message: 'Usuario asignado no encontrado' });
            }
        }

        await client.query('BEGIN');

        const maquinas = [];
        for (const idMaquina of machineIds) {
            const maquina = await maquinariaRepo.getMaquinariaById(idMaquina);
            if (!maquina) {
                throw Object.assign(new Error(`Máquina ${idMaquina} no encontrada`), { statusCode: 404 });
            }

            // Verificación reactiva: si la máquina ya superó el umbral del plan, bloquear y rechazar arriendo.
            const disponibilidad = await maquinariaRepo.getDisponibilidadMaquina(idMaquina, 0);
            const horasRestantes = Number(disponibilidad?.horas_restantes);
            const intervaloHoras = Number(disponibilidad?.intervalo_horas);
            const superaUmbralCritico = Number.isFinite(intervaloHoras)
                && intervaloHoras > 0
                && Number.isFinite(horasRestantes)
                && horasRestantes <= 0;

            if (superaUmbralCritico) {
                const motivoBloqueo = `Bloqueo automático por umbral crítico excedido (${Math.abs(horasRestantes).toFixed(1)}h sobre plan).`;
                await maquinariaRepo.blockMaquinariaWithReason(idMaquina, motivoBloqueo, 0);

                throw Object.assign(new Error(
                    `La máquina ${idMaquina} superó el umbral de mantenimiento y fue bloqueada automáticamente.`
                ), {
                    statusCode: 400,
                    estado_actual: 'Bloqueada',
                    accion_requerida: 'Finaliza mantenimiento y desbloquea la máquina antes de generar contratos de arriendo.'
                });
            }

            if (['Arrendada', 'Mantencion', 'Bloqueada', 'No Operativa'].includes(maquina.estado)) {
                console.warn(`[AUDITORIA] Intento fallido de arriendo. Máquina ID ${maquina.id_maquina} en estado: ${maquina.estado}.`);
                throw Object.assign(new Error(
                    maquina.estado === 'Arrendada'
                        ? `La máquina ${maquina.id_maquina} ya tiene un contrato activo.`
                        : `La máquina ${maquina.id_maquina} se encuentra en estado "${maquina.estado}".`
                ), {
                    statusCode: 400,
                    estado_actual: maquina.estado,
                    accion_requerida: maquina.estado === 'Arrendada'
                        ? 'Debe cerrarse o finalizarse el contrato activo antes de asignar otro usuario.'
                        : maquina.estado === 'Bloqueada'
                        ? 'Requiere inspección técnica y desbloqueo por parte del administrador.'
                        : 'Requiere que el mecánico finalice la orden de trabajo activa.'
                });
            }

            const contratoActivo = await arriendosRepo.getArriendoActivoByMaquina(idMaquina, client);
            if (contratoActivo) {
                throw Object.assign(new Error(`La máquina ${idMaquina} ya tiene un contrato activo`), { statusCode: 409 });
            }

            maquinas.push(maquina);
        }

        const contratos = [];
        for (const maquina of maquinas) {
            const contrato = await arriendosRepo.createArriendo({
                maquinaria_id_maquina: maquina.id_maquina,
                cliente_id: idCliente,
                horometro_entrada: horometro_entrada ?? maquina.horometro_actual,
                horometro_salida: horometro_salida ?? null,
                fecha_inicio,
                fecha_fin,
                estado_contrato: estado_contrato || 'Activo'
            }, client);
            contratos.push(contrato);
            if (idCliente !== null) {
                await maquinariaRepo.asignarOperadorAMaquina({
                    maquinaria_id_maquina: maquina.id_maquina,
                    operador_id: idCliente,
                    fecha_inicio: fecha_inicio || null,
                    fecha_fin: fecha_fin || null
                }, client);
            }
            await maquinariaRepo.updateMaquinariaEstado(maquina.id_maquina, 'Arrendada', client);
        }

        await client.query('COMMIT');

        return res.status(201).json({
            message: contratos.length === 1 ? 'Contrato creado exitosamente' : 'Contratos creados exitosamente',
            contratos,
            total: contratos.length
        });

    } catch (error) {
        try { await client.query('ROLLBACK'); } catch (rollbackError) {}
        if (error && error.statusCode) {
            return res.status(error.statusCode).json({
                message: error.message,
                estado_actual: error.estado_actual,
                accion_requerida: error.accion_requerida
            });
        }
        next(error);
    } finally {
        client.release();
    }
}

async function listContratos(req, res, next) {
    try {
        const rows = await arriendosRepo.listArriendos();
        return res.json(rows);
    } catch (error) {
        next(error);
    }
}

async function listMisContratos(req, res, next) {
    try {
        const clienteId = Number(req.user?.id_usuario);
        if (!Number.isFinite(clienteId)) {
            return res.status(400).json({ message: 'No se pudo identificar al usuario autenticado' });
        }

        const rows = await arriendosRepo.listArriendosByCliente(clienteId);
        return res.json(rows);
    } catch (error) {
        console.error('Error listando mis contratos:', error);
        return res.json([]);
    }
}

async function deleteContrato(req, res, next) {
    const client = await pool.connect();
    try {
        const id = Number(req.params.id_contrato);
        if (!Number.isFinite(id)) {
            return res.status(400).json({ message: 'id_contrato debe ser numerico' });
        }

        const contrato = await arriendosRepo.getArriendoById(id, client);
        if (!contrato) {
            return res.status(404).json({ message: 'Contrato no encontrado' });
        }

        await client.query('BEGIN');

        const deleted = await arriendosRepo.deleteArriendo(id, client);
        if (!deleted) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Contrato no encontrado' });
        }

        if (contrato.cliente_id !== null) {
            await maquinariaRepo.finalizarAsignacionActivaByMaquina(
                contrato.maquinaria_id_maquina,
                contrato.fecha_fin || null,
                client
            );
        }

        const stillActive = await arriendosRepo.getArriendoActivoByMaquina(contrato.maquinaria_id_maquina, client);
        const maquina = await maquinariaRepo.getMaquinariaById(contrato.maquinaria_id_maquina);
        if (!stillActive && maquina && maquina.estado === 'Arrendada') {
            await maquinariaRepo.updateMaquinariaEstado(contrato.maquinaria_id_maquina, 'Disponible', client);
        }

        await client.query('COMMIT');

        return res.status(204).send();
    } catch (error) {
        try { await client.query('ROLLBACK'); } catch (rollbackError) {}
        next(error);
    } finally {
        client.release();
    }
}

module.exports = {
    createContrato,
    listContratos,
    listMisContratos,
    deleteContrato
};