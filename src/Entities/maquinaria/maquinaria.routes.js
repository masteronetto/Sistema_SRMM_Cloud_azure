const { Router } = require('express');
const controller = require('./maquinaria.controller');
const { verifyToken, requireAdmin, requireMecanicoOperadorOrAdmin, requireMecanicoOrAdmin } = require('../../middleware/auth');

const router = Router();

router.use(verifyToken);

router.get('/', controller.list);
router.get('/mis-asignaciones', controller.getMisAsignaciones);
router.get('/urgent-maintenance', controller.listUrgentMaintenance);
router.get('/:id_maquina', controller.getById);
router.get('/:id_maquina/horas-acumuladas', controller.getHorasAcumuladas);
router.get('/:id_maquina/disponibilidad', controller.getDisponibilidad);
router.get('/:id_maquina/bloqueo', controller.getBloqueo);
router.get('/:id_maquina/incidencias', controller.getIncidencias);
router.post('/:id_maquina/incidencias', requireMecanicoOperadorOrAdmin, controller.createIncidencia);
router.post('/:id_maquina/asignar-operador', requireAdmin, controller.asignarOperador);
router.patch('/:id_maquina/desasignar-operador', requireAdmin, controller.desasignarOperador);
router.post('/', requireAdmin, controller.create);
router.post('/:id_maquina/bloqueo-critico', requireAdmin, controller.blockCritical);
router.post('/:id_maquina/notify-operator', requireAdmin, controller.notifyOperator);
router.put('/:id_maquina', requireMecanicoOrAdmin, controller.update);
router.patch('/:id_maquina/mark-not-operative', requireMecanicoOrAdmin, controller.markAsNotOperative);
router.patch('/:id_maquina/desbloquear', requireAdmin, controller.unblock);
router.delete('/:id_maquina', requireAdmin, controller.remove);

module.exports = router;
