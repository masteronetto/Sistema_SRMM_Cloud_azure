const {
  listNotificacionesAdmin,
  marcarNotificacionComoLeida,
  marcarTodasComoLeidas,
  deleteNotificacion,
} = require('./notificaciones_tiempo_real.controller');
const { verifyToken, requireAdmin, requireActiveUser } = require('../../middleware/auth');

const router = require('express').Router();

// Obtener todas las notificaciones del admin autenticado
router.get('/', verifyToken, requireActiveUser, requireAdmin, listNotificacionesAdmin);

// Marcar una notificación como leída
router.patch('/:id/leida', verifyToken, requireActiveUser, requireAdmin, marcarNotificacionComoLeida);

// Marcar todas las notificaciones como leídas
router.patch('/admin/leer-todas', verifyToken, requireActiveUser, requireAdmin, marcarTodasComoLeidas);

// Eliminar una notificación
router.delete('/:id', verifyToken, requireActiveUser, requireAdmin, deleteNotificacion);

module.exports = router;
