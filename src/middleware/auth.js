const jwt = require('jsonwebtoken');
const pool = require('../db/pool');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

function normalizeRole(role) {
  return String(role || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Obtiene estado y rol vigente del usuario desde BD.
 * Se usa en cada request autenticada para evitar sesiones "zombie"
 * y aplicar cambios de privilegios en tiempo real.
 */
async function getCurrentUserAuthState(userId) {
  try {
    const result = await pool.query(
      `SELECT
         id_usuario,
         rol_acceso,
         COALESCE((to_jsonb(usuarios) ->> 'activo')::boolean, TRUE) AS activo
       FROM usuarios
       WHERE id_usuario = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return null; // Usuario eliminado/no existe
    }

    return result.rows[0];
  } catch (error) {
    console.error('Error al consultar estado de autenticacion de usuario:', error);
    return null;
  }
}

async function verifyToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Token no proporcionado' });
    }

    const token = authHeader.substring(7);
    const payload = jwt.verify(token, JWT_SECRET);

    const userId = Number(payload?.id_usuario);
    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(401).json({ message: 'Token inválido' });
    }

    const currentUser = await getCurrentUserAuthState(userId);
    if (!currentUser) {
      return res.status(401).json({
        message: 'La sesión ya no es válida para este usuario.',
        session_invalidated: true
      });
    }

    if (currentUser.activo !== true) {
      return res.status(401).json({
        message: 'Tu cuenta ha sido desactivada. Contacta al administrador.',
        deactivated: true,
        session_invalidated: true
      });
    }

    // Conserva datos del token, pero fuerza rol actual vigente desde BD.
    req.user = {
      ...payload,
      id_usuario: currentUser.id_usuario,
      rol_acceso: currentUser.rol_acceso,
      account_active: true,
      account_state_checked: true
    };
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expirado' });
    }
    return res.status(401).json({ message: 'Token inválido' });
  }
}

/**
 * Middleware que valida que el usuario siga activo
 * Debe usarse después de verifyToken
 */
async function requireActiveUser(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'No autenticado' });
    }

    if (req.user.account_state_checked && req.user.account_active === true) {
      return next();
    }

    const currentUser = await getCurrentUserAuthState(req.user.id_usuario);
    if (!currentUser || currentUser.activo !== true) {
      return res.status(401).json({ 
        message: 'Tu cuenta ha sido desactivada. Contacta al administrador.',
        deactivated: true,
        session_invalidated: true
      });
    }

    req.user.rol_acceso = currentUser.rol_acceso;
    req.user.account_active = true;
    req.user.account_state_checked = true;

    next();
  } catch (error) {
    console.error('Error en requireActiveUser:', error);
    return res.status(500).json({ message: 'Error al verificar estado de usuario' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: 'No autenticado' });
  }

  if (normalizeRole(req.user.rol_acceso) !== 'administrador') {
    return res.status(403).json({ message: 'Permisos insuficientes. Solo administradores pueden realizar esta acción.' });
  }

  next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: 'No autenticado' });
  }
  next();
}

function requireMecanicoOrAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: 'No autenticado' });
  }

  const role = normalizeRole(req.user.rol_acceso);
  if (role === 'mecanico' || role === 'administrador') {
    return next();
  }

  return res.status(403).json({ message: 'Permisos insuficientes. Requiere rol Mecánico o Administrador.' });
}

function requireOperadorOrAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: 'No autenticado' });
  }

  const role = normalizeRole(req.user.rol_acceso);
  if (role === 'operador' || role === 'administrador') {
    return next();
  }

  return res.status(403).json({ message: 'Permisos insuficientes. Requiere rol Operador o Administrador.' });
}

function requireMecanicoOperadorOrAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: 'No autenticado' });
  }

  const role = normalizeRole(req.user.rol_acceso);
  if (role === 'mecanico' || role === 'operador' || role === 'administrador') {
    return next();
  }

  return res.status(403).json({ message: 'Permisos insuficientes. Requiere rol Mecánico, Operador o Administrador.' });
}

module.exports = {
  verifyToken,
  requireAdmin,
  requireAuth,
  requireMecanicoOrAdmin,
  requireOperadorOrAdmin,
  requireMecanicoOperadorOrAdmin,
  requireActiveUser
};

