const express = require('express');
const router = express.Router();
const roleRequestsController = require('./role_requests.controller');
const authMiddleware = require('../../middleware/auth');

// Crear una solicitud de cambio de rol (usuario autenticado)
router.post('/', authMiddleware.verifyToken, authMiddleware.requireActiveUser, roleRequestsController.createRequest);
router.get('/', authMiddleware.verifyToken, authMiddleware.requireActiveUser, authMiddleware.requireAdmin, roleRequestsController.listRequests);
router.delete('/:id', authMiddleware.verifyToken, authMiddleware.requireActiveUser, authMiddleware.requireAdmin, roleRequestsController.deleteRequest);

module.exports = router;
