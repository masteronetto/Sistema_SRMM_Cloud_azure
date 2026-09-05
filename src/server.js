const app = require('./app');
const { port, hasDatabaseConfig } = require('./config/env');
const intervaloVerificacionRetrasos = Number(process.env.INTERVALO_VERIFICACION_RETRASOS || 86400000);

// Evitar iniciar servidores, Socket.IO o schedulers en entornos serverless (ej. Vercel)
const isStandaloneProcess = require.main === module && !process.env.VERCEL;

async function ejecutarChequeoRetrasos(io) {
  if (!hasDatabaseConfig) {
    return;
  }

  try {
    const mantenimientosController = require('./Entities/mantenimientos/mantenimientos.controller');
    await mantenimientosController.procesarRetrasos(io);
  } catch (error) {
    console.error('[Scheduler] Error verificando retrasos de mantenimiento:', error);
  }
} 

async function verificarFaltasDeRegistro(io) {
  if (!hasDatabaseConfig) {
    return;
  }

  console.log('[Scheduler] Buscando máquinas sin registro de horómetro en las últimas 24 hrs...');
  try {
    const pool = require('./db/pool');
    const query = `
      SELECT
        m.id_maquina,
        m.modelo_equipo,
        COALESCE(MAX(h.created_at), m.created_at) AS ultimo_registro_ts
      FROM maquinaria m
      LEFT JOIN historial_horometro h ON m.id_maquina = h.maquinaria_id_maquina
      WHERE m.estado NOT IN ('Mantencion', 'Bloqueada', 'No Operativa')
      GROUP BY m.id_maquina, m.modelo_equipo, m.created_at
      HAVING COALESCE(MAX(h.created_at), m.created_at) < NOW() - INTERVAL '24 hours'
    `;
    
    const { rows } = await pool.query(query);

    for (const maq of rows) {
      const alertaExistente = await pool.query(
        `
        SELECT id_alerta
        FROM alertas_criticas
        WHERE maquinaria_id_maquina = $1
          AND tipo_alerta = 'Advertencia'
          AND estado_alerta = 'Pendiente'
        ORDER BY created_at DESC
        LIMIT 1
        `,
        [maq.id_maquina]
      );

      if (alertaExistente.rowCount > 0) {
        continue;
      }

      await pool.query(`
        INSERT INTO alertas_criticas (maquinaria_id_maquina, tipo_alerta, estado_alerta, porcentaje_umbral, horometro_critico, requiere_mantenimiento)
        VALUES ($1, 'Advertencia', 'Pendiente', 0, 0, FALSE)
      `, [maq.id_maquina]);
      
      console.log(`[ALERTA INTERNA] Máquina ID: ${maq.id_maquina} (${maq.modelo_equipo}) sin registro de horómetro desde ${maq.ultimo_registro_ts}. Operador será notificado.`);
      
      if (io) {
        io.emit('alerta:nueva', {
          tipo: 'Advertencia',
          mensaje: `La máquina ${maq.modelo_equipo} lleva más de 24 hrs sin registro.`
        });
      }
    }
  } catch (error) {
    console.error('[Scheduler] Error al verificar registros:', error);
  }
}

if (!isStandaloneProcess && hasDatabaseConfig) {
  // En entornos serverless no iniciar schedulers ni procesos en background
  console.log('Entorno serverless detectado: schedulers deshabilitados.');
}

if (isStandaloneProcess) {
  const http = require('http');
  const { setupSocketIO } = require('./config/socketio');

  // Crear servidor HTTP para soportar WebSocket
  const httpServer = http.createServer(app);

  // Configurar Socket.IO
  const io = setupSocketIO(httpServer);

  // Hacer io accesible en la app
  app.set('io', io);

  if (hasDatabaseConfig) {
    // Iniciar schedulers solo en modo standalone
    verificarFaltasDeRegistro(io);
    setInterval(() => verificarFaltasDeRegistro(io), 86400000);
    ejecutarChequeoRetrasos(io);
    setInterval(() => ejecutarChequeoRetrasos(io), intervaloVerificacionRetrasos);
  } else {
    console.log('Modo frontend activo: la API y el scheduler de BD están deshabilitados hasta configurar PostgreSQL.');
  }

  httpServer.listen(port, () => {
    console.log(`SRMM API escuchando en puerto ${port}`);
    console.log(`WebSocket (Socket.IO) disponible en puerto ${port}`);
    console.log(`Chequeo automático de retrasos cada ${intervaloVerificacionRetrasos} ms`);
  });
}

module.exports = app;
