const { Router } = require('express');
const controller = require('./usuarios.controller');
const { verifyToken, requireAdmin, requireActiveUser } = require('../../middleware/auth');

const router = Router();

// Ruta protegida: historial de auditoria de cambios de usuarios (solo admin)
router.get('/audit-logs', verifyToken, requireActiveUser, requireAdmin, controller.listAuditLogs);

router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

// Ruta protegida: solo admins pueden editar nombre/correo de usuarios
router.put('/:id/profile', verifyToken, requireActiveUser, requireAdmin, controller.updateProfile);

// Ruta protegida: solo admins pueden cambiar roles
router.put('/:id/role', verifyToken, requireActiveUser, requireAdmin, controller.changeRole);

// Ruta protegida: solo admins pueden desactivar usuarios
router.put('/:id/deactivate', verifyToken, requireActiveUser, requireAdmin, controller.deactivate);

// Ruta protegida: solo admins pueden reactivar usuarios
router.put('/:id/activate', verifyToken, requireActiveUser, requireAdmin, controller.activate);

module.exports = router;
