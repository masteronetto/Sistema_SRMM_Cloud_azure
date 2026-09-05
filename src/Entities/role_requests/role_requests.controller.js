const nodemailer = require('nodemailer');
const roleRequestsRepo = require('./role_requests.repository');
const usuariosRepo = require('../usuarios/usuarios.repository');

function createTransporterIfConfigured() {
  // Permite configurar SMTP genérico o Gmail mediante variables de entorno
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }

  if (process.env.SMTP_GMAIL === 'true' && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }

  return null;
}

async function createRequest(req, res, next) {
  try {
    const usuario = req.user; // middleware auth agrega user

    if (!usuario) return res.status(401).json({ message: 'No autorizado' });

    const usuarioDb = await usuariosRepo.getUsuarioById(usuario.id_usuario);
    if (!usuarioDb) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const nombre_usuario = String(usuarioDb.nombre_completo || '').trim() || null;
    const email_usuario = usuarioDb.email || usuario.email;
    const rol_actual = usuarioDb.rol_acceso || usuario.rol_acceso || 'Usuario';

    const normalizedMessage = [
      'Solicitud de cambio de rol',
      `Solicitante: ${nombre_usuario || `Usuario #${usuarioDb.id_usuario}`}`,
      `Correo: ${email_usuario || 'Sin correo'}`,
      `Rol actual: ${rol_actual}`,
    ].join(' | ');

    const existingRequest = await roleRequestsRepo.getPendingRoleRequestByUsuarioId(usuario.id_usuario);
    if (existingRequest) {
      await roleRequestsRepo.updatePendingRoleRequestByUsuarioId(usuario.id_usuario, {
        nombre_usuario,
        email_usuario,
        mensaje: normalizedMessage,
      });

      return res.status(409).json({
        message: 'Ya enviaste una solicitud de cambio de rol. Espera a que el administrador la revise y actualice tu rol.'
      });
    }

    const created = await roleRequestsRepo.createRoleRequest({
      usuario_id: usuario.id_usuario,
      nombre_usuario,
      email_usuario,
      mensaje: normalizedMessage,
    });

    // Notificar por correo al administrador si está configurado
    const transporter = createTransporterIfConfigured();
    const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_ADMIN || 'admin@localhost';
    if (transporter) {
      const subject = `Nueva solicitud de rol de ${nombre_usuario || email_usuario}`;
      const text = `Usuario: ${nombre_usuario || ''} <${email_usuario}>
    Mensaje: ${normalizedMessage}
Ver solicitud en el panel de administración.`;

      try {
        await transporter.sendMail({
          from: process.env.SMTP_FROM || 'no-reply@sistema-srmm',
          to: adminEmail,
          subject,
          text,
        });
      } catch (err) {
        console.warn('No se pudo enviar email de notificación al admin:', err.message || err);
      }
    }

    return res.status(201).json({ message: 'Solicitud creada', request: created });
  } catch (error) {
    return next(error);
  }
}

async function listRequests(req, res, next) {
  try {
    const limit = Number(req.query.limit || 50);
    const offset = Number(req.query.offset || 0);
    const requests = await roleRequestsRepo.listRoleRequests({ limit, offset });

    return res.json(requests);
  } catch (error) {
    return next(error);
  }
}

async function deleteRequest(req, res, next) {
  try {
    const idRequest = Number(req.params.id);
    if (!Number.isFinite(idRequest)) {
      return res.status(400).json({ message: 'ID de solicitud inválido' });
    }

    const deleted = await roleRequestsRepo.deleteRoleRequest(idRequest);
    if (!deleted) {
      return res.status(404).json({ message: 'Solicitud no encontrada' });
    }

    return res.json({ message: 'Solicitud eliminada' });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createRequest,
  listRequests,
  deleteRequest,
};
