const { Router } = require('express');
const incidenciasController = require('./incidencias.controller');
const { verifyToken, requireMecanicoOperadorOrAdmin, requireMecanicoOrAdmin, requireActiveUser } = require('../../middleware/auth');

const router = Router();

// Listar incidencias (GET /api/incidencias) - solo Mecanico/Operador/Administrador
router.get('/', verifyToken, requireActiveUser, requireMecanicoOperadorOrAdmin, incidenciasController.listarIncidencias);

// Registrar una incidencia (POST /api/incidencias) - solo Mecanico/Operador/Administrador
router.post('/', verifyToken, requireActiveUser, requireMecanicoOperadorOrAdmin, incidenciasController.crearIncidencia);

// Resolver una incidencia (PATCH /api/incidencias/:id_incidencia/resolver) - solo Mecanico/Administrador
router.patch('/:id_incidencia/resolver', verifyToken, requireActiveUser, requireMecanicoOrAdmin, incidenciasController.resolverIncidencia);

module.exports = router;