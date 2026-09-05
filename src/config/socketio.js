const { Server } = require('socket.io');

// Almacenar usuarios conectados por rol
const usuariosConectados = new Map();

function normalizeRole(role) {
  return String(role || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function setupSocketIO(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log(`[Socket.IO] Usuario conectado: ${socket.id}`);

    // Usuario se identifica como administrador o mecánico
    socket.on('usuario:conectar', (data) => {
      const { usuarioId, rol } = data;
      
      if (!usuarioId || !rol) {
        socket.emit('error', { mensaje: 'usuarioId y rol requeridos' });
        return;
      }

      // Guardar conexión
      usuariosConectados.set(socket.id, { usuarioId, rol, socketId: socket.id });
      
      console.log(`[Socket.IO] Usuario ${usuarioId} (${rol}) conectado en socket ${socket.id}`);
      
      socket.emit('conectado', { 
        mensaje: 'Conectado correctamente',
        socketId: socket.id,
        usuarioId,
        rol
      });

      // Broadcast a otros usuarios que alguien se conectó
      io.emit('usuario:conectadoEnSistema', { 
        usuarioId, 
        rol,
        timestamp: new Date()
      });
    });

    // Recibir ACK de notificación (usuario leyó/marcó como leída)
    socket.on('notificacion:leida', (data) => {
      const { notificacionId } = data;
      console.log(`[Socket.IO] Notificación ${notificacionId} marcada como leída`);
      
      // Broadcast a otros admins
      io.emit('notificacion:estadoActualizado', {
        notificacionId,
        estado: 'leida',
        timestamp: new Date()
      });
    });

    socket.on('disconnect', () => {
      const usuario = usuariosConectados.get(socket.id);
      if (usuario) {
        usuariosConectados.delete(socket.id);
        console.log(`[Socket.IO] Usuario ${usuario.usuarioId} desconectado`);
        
        io.emit('usuario:desconectadoDelSistema', {
          usuarioId: usuario.usuarioId,
          rol: usuario.rol,
          timestamp: new Date()
        });
      }
    });
  });

  return io;
}

// Función para enviar notificación a todos los administradores conectados
function enviarNotificacionAAdministradores(io, notificacion) {
  const administradores = Array.from(usuariosConectados.values()).filter(
    (usuario) => normalizeRole(usuario.rol) === 'administrador'
  );

  administradores.forEach((admin) => {
    io.to(admin.socketId).emit('alerta:nueva', notificacion);
  });

  console.log(
    `[Socket.IO] Notificación enviada a ${administradores.length} administrador(es)`
  );
}

// Función para enviar notificación a un mecánico específico
function enviarNotificacionAMecanico(io, mecanicoId, notificacion) {
  const mecanico = Array.from(usuariosConectados.values()).find(
    (usuario) => String(usuario.usuarioId) === String(mecanicoId) && normalizeRole(usuario.rol) === 'mecanico'
  );

  if (mecanico) {
    io.to(mecanico.socketId).emit('ordenTrabajo:asignada', notificacion);
    console.log(`[Socket.IO] Notificación de orden enviada al mecánico ${mecanicoId}`);
  }
}

// Función para obtener status de conexión
function obtenerUsuariosConectados() {
  return Array.from(usuariosConectados.values());
}

module.exports = {
  setupSocketIO,
  enviarNotificacionAAdministradores,
  enviarNotificacionAMecanico,
  obtenerUsuariosConectados,
};
