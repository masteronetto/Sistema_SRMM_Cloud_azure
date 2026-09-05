const notificacionesRepo = require('./notificaciones_tiempo_real.repository');

/**
 * GET /api/notificaciones-tiempo-real
 * Obtener todas las notificaciones del admin autenticado
 * Query params:
 * - solo_no_leidas: boolean (default: false)
 * - limite: number (default: 50)
 * - offset: number (default: 0)
 */
async function listNotificacionesAdmin(req, res) {
  try {
    const adminId = Number(req.user?.id_usuario);
    if (!Number.isFinite(adminId)) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }
    const { solo_no_leidas, limite, offset } = req.query;

    const notificaciones = await notificacionesRepo.obtenerNotificacionesAdmin(adminId, {
      solo_no_leidas: solo_no_leidas === 'true',
      limite: parseInt(limite) || 50,
      offset: parseInt(offset) || 0,
    });

    const countNoLeidas = await notificacionesRepo.obtenerCountNotificacionesNoLeidas(
      adminId
    );

    res.status(200).json({
      cantidad: notificaciones.length,
      no_leidas: countNoLeidas,
      data: notificaciones,
    });
  } catch (error) {
    console.error('[notificaciones-tiempo-real] Error listando notificaciones:', error);
    res.status(500).json({
      error: 'Error al obtener notificaciones',
      mensaje: error.message,
    });
  }
}

/**
 * PATCH /api/notificaciones-tiempo-real/:id/leida
 * Marcar una notificación como leída
 */
async function marcarNotificacionComoLeida(req, res) {
  try {
    const { id } = req.params;
    const adminId = Number(req.user?.id_usuario);
    if (!Number.isFinite(adminId)) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    const notificacion = await notificacionesRepo.marcarComoLeida(parseInt(id), adminId);

    if (!notificacion) {
      return res.status(404).json({
        error: 'Notificación no encontrada',
      });
    }

    res.status(200).json({
      mensaje: 'Notificación marcada como leída',
      notificacion,
    });
  } catch (error) {
    console.error('[notificaciones-tiempo-real] Error marcando como leída:', error);
    res.status(500).json({
      error: 'Error al marcar notificación',
      mensaje: error.message,
    });
  }
}

/**
 * PATCH /api/notificaciones-tiempo-real/admin/leer-todas
 * Marcar todas las notificaciones como leídas
 */
async function marcarTodasComoLeidas(req, res) {
  try {
    const adminId = Number(req.user?.id_usuario);
    if (!Number.isFinite(adminId)) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    const cantidad = await notificacionesRepo.marcarTodasComoLeidas(adminId);

    res.status(200).json({
      mensaje: `${cantidad} notificación(es) marcada(s) como leída(s)`,
      cantidad_actualizada: cantidad,
    });
  } catch (error) {
    console.error('[notificaciones-tiempo-real] Error marcando todas como leídas:', error);
    res.status(500).json({
      error: 'Error al marcar notificaciones',
      mensaje: error.message,
    });
  }
}

/**
 * DELETE /api/notificaciones-tiempo-real/:id
 * Eliminar una notificación
 */
async function deleteNotificacion(req, res) {
  try {
    const { id } = req.params;
    const adminId = Number(req.user?.id_usuario);
    if (!Number.isFinite(adminId)) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    const eliminada = await notificacionesRepo.eliminarNotificacion(parseInt(id), adminId);

    if (!eliminada) {
      return res.status(404).json({
        error: 'Notificación no encontrada',
      });
    }

    res.status(200).json({
      mensaje: 'Notificación eliminada',
    });
  } catch (error) {
    console.error('[notificaciones-tiempo-real] Error eliminando notificación:', error);
    res.status(500).json({
      error: 'Error al eliminar notificación',
      mensaje: error.message,
    });
  }
}

module.exports = {
  listNotificacionesAdmin,
  marcarNotificacionComoLeida,
  marcarTodasComoLeidas,
  deleteNotificacion,
};
