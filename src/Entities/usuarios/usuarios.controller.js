const usuariosRepo = require('./usuarios.repository');
const roleRequestsRepo = require('../role_requests/role_requests.repository');
const bcrypt = require('bcrypt');

const rolesPermitidos = new Set(['Administrador', 'Mecanico', 'Operador', 'Usuario']);

async function registrarAuditoriaUsuario({ tipoOperacion, usuarioObjetivoId = null, ejecutadoPorId = null, detalle = {} }) {
  try {
    await usuariosRepo.insertUsuarioAuditLog({
      tipo_operacion: tipoOperacion,
      usuario_objetivo_id: usuarioObjetivoId,
      ejecutado_por_id: ejecutadoPorId,
      detalle
    });
  } catch (auditError) {
    // La auditoria no debe romper la operación principal.
    console.warn('No se pudo registrar auditoria de usuarios:', auditError.message || auditError);
  }
}

function validateUsuarioProfilePayload(payload) {
  const nombre = String(payload?.nombre_completo || '').trim();
  const email = String(payload?.email || '').trim().toLowerCase();

  if (!nombre || !email) {
    return { error: 'nombre_completo y email son obligatorios', parsed: null };
  }

  if (nombre.length < 3) {
    return { error: 'El nombre completo debe tener al menos 3 caracteres', parsed: null };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const dominiosPermitidos = ['srmm.cl', 'gmail.com', 'hotmail.com', 'outlook.com', 'live.com'];
  if (!emailRegex.test(email)) {
    return { error: 'El formato del correo electronico es invalido', parsed: null };
  }

  if (!dominiosPermitidos.some((dominio) => email.endsWith(`@${dominio}`))) {
    return { error: 'Dominio de correo no permitido', parsed: null };
  }

  return {
    error: null,
    parsed: {
      nombre_completo: nombre,
      email
    }
  };
}

function validateUsuarioPayload(payload) {
  const { nombre_completo, email, contrasena, rol_acceso } = payload;

  if (!nombre_completo || !email || !contrasena || !rol_acceso) {
    return 'Todos los campos son obligatorios: nombre_completo, email, contrasena, rol_acceso';
  }

  if (!rolesPermitidos.has(rol_acceso)) {
    return 'rol_acceso invalido. Valores permitidos: Administrador, Mecanico, Operador, Usuario';
  }

  if (nombre_completo.trim().length < 3) {
    return 'El nombre completo debe tener al menos 3 caracteres';
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const dominiosPermitidos = ['srmm.cl', 'gmail.com', 'hotmail.com', 'outlook.com', 'live.com'];
  if (!emailRegex.test(email)) { 
    return 'El formato del correo electronico es invalido';
  }

  if (!dominiosPermitidos.some(dominio => email.endsWith(`@${dominio}`))) {
    return 'Dominio de correo no permitido';
  }

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&_])[A-Za-z\d@$!%*?&_]{8,}$/;
if (!passwordRegex.test(contrasena)) {
    return 'La contrasena debe tener al menos 8 caracteres, incluir una mayuscula, una minuscula, un numero y un caracter especial autorizado (@, $, !, %, *, ?, &, _)';
  }

  return null;
}

async function list(req, res, next) {
  try {
    const data = await usuariosRepo.listUsuarios();
    res.json(data);
  } catch (error) {
    next(error);
  }
}

async function getById(req, res, next) {
  try {
    const id = Number(req.params.id);
    const data = await usuariosRepo.getUsuarioById(id);

    if (!data) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

async function create(req, res, next) {
  try {
    const validationError = validateUsuarioPayload(req.body);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(req.body.contrasena, saltRounds);
    req.body.contrasena = hashedPassword;

    const data = await usuariosRepo.createUsuario(req.body);

    await registrarAuditoriaUsuario({
      tipoOperacion: 'ALTA_USUARIO',
      usuarioObjetivoId: data.id_usuario,
      ejecutadoPorId: req.user?.id_usuario || null,
      detalle: {
        nombre_completo: data.nombre_completo,
        email: data.email,
        rol_acceso: data.rol_acceso
      }
    });

    return res.status(201).json(data);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Ya existe un usuario con ese email' });
    }
    return next(error);
  }
}

async function update(req, res, next) {
  try {
    const id = Number(req.params.id);
    const validationError = validateUsuarioPayload(req.body);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(req.body.contrasena, saltRounds);
    req.body.contrasena = hashedPassword;

    const previo = await usuariosRepo.getUsuarioById(id);
    const data = await usuariosRepo.updateUsuario(id, req.body);
    if (!data) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    await registrarAuditoriaUsuario({
      tipoOperacion: 'MODIFICACION_USUARIO',
      usuarioObjetivoId: data.id_usuario,
      ejecutadoPorId: req.user?.id_usuario || null,
      detalle: {
        antes: previo ? {
          nombre_completo: previo.nombre_completo,
          email: previo.email,
          rol_acceso: previo.rol_acceso,
          activo: previo.activo
        } : null,
        despues: {
          nombre_completo: data.nombre_completo,
          email: data.email,
          rol_acceso: data.rol_acceso,
          activo: data.activo
        }
      }
    });

    return res.json(data);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Ya existe un usuario con ese email' });
    }
    return next(error);
  }
}

async function remove(req, res, next) {
  try {
    const id = Number(req.params.id);
    const previo = await usuariosRepo.getUsuarioById(id);
    const deleted = await usuariosRepo.deleteUsuario(id);

    if (!deleted) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    await registrarAuditoriaUsuario({
      tipoOperacion: 'ELIMINACION_USUARIO',
      usuarioObjetivoId: id,
      ejecutadoPorId: req.user?.id_usuario || null,
      detalle: {
        eliminado: true,
        usuario: previo || null
      }
    });

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}

async function changeRole(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { rol_acceso } = req.body;

    if (!rol_acceso) {
      return res.status(400).json({ message: 'rol_acceso es requerido' });
    }

    if (!rolesPermitidos.has(rol_acceso)) {
      return res.status(400).json({ message: 'rol_acceso inválido. Valores permitidos: Administrador, Mecanico, Operador, Usuario' });
    }

    // No permite cambiar el rol del usuario actual a sí mismo
    if (req.user && req.user.id_usuario === id && rol_acceso !== req.user.rol_acceso) {
      // Permite cambios, pero es mejor lo advierta
    }

    const usuarioPrevio = await usuariosRepo.getUsuarioById(id);
    const data = await usuariosRepo.updateUsuarioRole(id, rol_acceso);
    if (!data) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const deletedRequests = await roleRequestsRepo.deleteRoleRequestsByUsuarioId(id);

    await registrarAuditoriaUsuario({
      tipoOperacion: 'CAMBIO_ROL_USUARIO',
      usuarioObjetivoId: data.id_usuario,
      ejecutadoPorId: req.user?.id_usuario || null,
      detalle: {
        rol_anterior: usuarioPrevio?.rol_acceso || null,
        rol_nuevo: data.rol_acceso,
        deleted_role_requests: deletedRequests
      }
    });

    return res.json({
      message: 'Rol actualizado correctamente',
      user: data,
      deleted_role_requests: deletedRequests,
    });
  } catch (error) {
    return next(error);
  }
}

async function updateProfile(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: 'id de usuario invalido' });
    }

    const { error, parsed } = validateUsuarioProfilePayload(req.body);
    if (error) {
      return res.status(400).json({ message: error });
    }

    const usuarioPrevio = await usuariosRepo.getUsuarioById(id);
    const data = await usuariosRepo.updateUsuarioProfile(id, parsed);
    if (!data) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    await registrarAuditoriaUsuario({
      tipoOperacion: 'MODIFICACION_PERFIL_USUARIO',
      usuarioObjetivoId: data.id_usuario,
      ejecutadoPorId: req.user?.id_usuario || null,
      detalle: {
        nombre_anterior: usuarioPrevio?.nombre_completo || null,
        email_anterior: usuarioPrevio?.email || null,
        nombre_nuevo: data.nombre_completo,
        email_nuevo: data.email
      }
    });

    return res.json({
      message: 'Datos de usuario actualizados correctamente',
      user: data
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Ya existe un usuario con ese email' });
    }
    return next(error);
  }
}

async function deactivate(req, res, next) {
  try {
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ message: 'ID de usuario invalido' });
    }

    const usuario = await usuariosRepo.getUsuarioById(id);
    if (!usuario) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // No permitir desactivar propio usuario
    if (req.user.id_usuario === parseInt(id)) {
      return res.status(400).json({ message: 'No puedes desactivar tu propia cuenta' });
    }

    const result = await usuariosRepo.deactivateUsuario(id);

    await registrarAuditoriaUsuario({
      tipoOperacion: 'DESACTIVACION_USUARIO',
      usuarioObjetivoId: result.id_usuario,
      ejecutadoPorId: req.user?.id_usuario || null,
      detalle: {
        activo: false,
        email: result.email,
        rol_acceso: result.rol_acceso
      }
    });

    return res.json({
      message: 'Usuario desactivado correctamente',
      user: result
    });
  } catch (error) {
    return next(error);
  }
}

async function activate(req, res, next) {
  try {
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ message: 'ID de usuario invalido' });
    }

    const usuario = await usuariosRepo.getUsuarioById(id);
    if (!usuario) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const result = await usuariosRepo.activateUsuario(id);

    await registrarAuditoriaUsuario({
      tipoOperacion: 'REACTIVACION_USUARIO',
      usuarioObjetivoId: result.id_usuario,
      ejecutadoPorId: req.user?.id_usuario || null,
      detalle: {
        activo: true,
        email: result.email,
        rol_acceso: result.rol_acceso
      }
    });

    return res.json({
      message: 'Usuario reactivado correctamente',
      user: result
    });
  } catch (error) {
    return next(error);
  }
}

async function listAuditLogs(req, res, next) {
  try {
    const limit = Math.min(Number(req.query.limit || 100), 300);
    const offset = Math.max(Number(req.query.offset || 0), 0);
    const data = await usuariosRepo.listUsuarioAuditLogs({ limit, offset });
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  changeRole,
  updateProfile,
  deactivate,
  activate,
  listAuditLogs
};
