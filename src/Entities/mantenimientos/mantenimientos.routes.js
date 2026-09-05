const { Router } = require('express');
const controller = require('./mantenimientos.controller');
const { verifyToken, requireMecanicoOrAdmin } = require('../../middleware/auth');

const router = Router();

// Rutas de mantenimiento histórico.
router.post('/', controller.create);
router.get('/maquina/:maquinaria_id_maquina', controller.listByMaquina);
router.get('/maquina/:maquinaria_id_maquina/historial', controller.historialByMaquina);
router.get('/tipos-servicio', controller.tiposServicio);

// Órdenes de trabajo para programar mantenimientos preventivos.
router.post('/programar', verifyToken, requireMecanicoOrAdmin, controller.programar);
router.get('/ordenes', verifyToken, controller.listOrdenes);
router.get('/ordenes/atrasadas', controller.listOrdenesAtrasadas);
router.post('/ordenes/verificar-retrasos', controller.verificarRetrasos);
router.get('/ordenes/maquina/:maquinaria_id_maquina', controller.listOrdenesMaquina);
router.get('/ordenes/mecanico/:mecanico_id', controller.listOrdenesMecanico);
router.patch('/ordenes/:id_orden/iniciar', verifyToken, requireMecanicoOrAdmin, controller.iniciar);
// Obtener una orden por ID
router.get('/ordenes/:id_orden', verifyToken, requireMecanicoOrAdmin, controller.getOrdenById);
router.delete('/ordenes/:id_orden', verifyToken, requireMecanicoOrAdmin, controller.eliminarOrden);

// Completar orden de trabajo
router.patch('/ordenes/:id_orden/completar', verifyToken, requireMecanicoOrAdmin, controller.completar);

module.exports = router;
