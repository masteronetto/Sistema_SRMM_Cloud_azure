const { Router } = require('express');
const controller = require('./reportes.controller');
const { verifyToken, requireMecanicoOrAdmin, requireMecanicoOperadorOrAdmin, requireAdmin, requireActiveUser } = require('../../middleware/auth');

const router = Router();

router.get('/historial-unificado/:id_maquina', verifyToken, requireActiveUser, controller.obtenerHistorialMaquina);
router.get('/top-maquinas', verifyToken, requireActiveUser, controller.obtenerTopMaquinas);
router.get('/estadisticas', verifyToken, requireActiveUser, controller.obtenerEstadisticas);
router.get('/uso-historico/:id_maquina', verifyToken, requireActiveUser, controller.obtenerUsoHistorico);
router.get('/operador/resumen', verifyToken, requireActiveUser, requireMecanicoOperadorOrAdmin, controller.obtenerResumenOperador);
router.get('/autores', verifyToken, requireActiveUser, requireMecanicoOrAdmin, controller.obtenerActividadPorAutor);
router.get('/fallas/propias', verifyToken, requireActiveUser, requireMecanicoOperadorOrAdmin, controller.obtenerReporteFallasPropias);
router.get('/fallas', verifyToken, requireActiveUser, requireMecanicoOrAdmin, controller.obtenerReporteFallas);
router.get('/mantenimientos', verifyToken, requireActiveUser, requireMecanicoOrAdmin, controller.obtenerReporteMantenimientos);
router.get('/ingresos', verifyToken, requireActiveUser, requireAdmin, controller.obtenerIngresos);
router.get('/ingresos/csv', verifyToken, requireActiveUser, requireAdmin, controller.obtenerIngresosCsv);

module.exports = router;