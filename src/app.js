const express = require('express');
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const { hasDatabaseConfig, hasDatabaseUrl } = require('./config/env');

const app = express();
app.set('trust proxy', true);

const staticDirCandidates = [
  path.join(__dirname, '..', 'public'),
  path.join(__dirname, '..', 'frontend')
];
const publicPath = staticDirCandidates.find((dirPath) => fs.existsSync(path.join(dirPath, 'index.html'))) || staticDirCandidates[0];

function staticFilePath(fileName) {
  return path.join(publicPath, fileName);
}

function staticFileExists(fileName) {
  return fs.existsSync(staticFilePath(fileName));
}

let ogPngBuffer;

function getOgPngBuffer() {
  if (ogPngBuffer) {
    return ogPngBuffer;
  }

  const width = 1200;
  const height = 630;
  const png = new PNG({ width, height });

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (width * y + x) << 2;
      const ratioX = x / (width - 1);
      const ratioY = y / (height - 1);

      const r = Math.round(15 + (79 - 15) * ratioX);
      const g = Math.round(23 + (70 - 23) * ratioY);
      const b = Math.round(42 + (229 - 42) * (0.6 * ratioX + 0.4 * ratioY));

      png.data[idx] = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = 255;
    }
  }

  ogPngBuffer = PNG.sync.write(png);
  return ogPngBuffer;
}

function isDatabaseUnavailableError(error) {
  if (!error) {
    return false;
  }

  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
    return true;
  }

  if (Array.isArray(error.errors)) {
    return error.errors.some((dbError) => (
      dbError && (dbError.code === 'ECONNREFUSED' || dbError.code === 'ENOTFOUND' || dbError.code === 'ETIMEDOUT')
    ));
  }

  return false;
}

app.use(express.json());
app.use(express.static(publicPath));

app.get(['/favicon.ico', '/favicon.png'], (_req, res) => {
  if (!staticFileExists('favicon.svg')) {
    return res.status(404).json({ message: 'favicon no encontrado' });
  }

  res.type('image/svg+xml');
  res.sendFile(staticFilePath('favicon.svg'));
});

app.get('/', (_req, res) => {
  // Priorizar página de login si existe
  if (staticFileExists('login.html')) {
    return res.sendFile(staticFilePath('login.html'));
  }

  if (!staticFileExists('index.html')) {
    return res.status(500).json({ message: 'index.html no encontrado en frontend estático' });
  }

  return res.sendFile(staticFilePath('index.html'));
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/robots.txt', (_req, res) => {
  if (!staticFileExists('robots.txt')) {
    return res.status(404).type('text/plain').send('User-agent: *\nAllow: /\n');
  }

  res.type('text/plain');
  res.sendFile(staticFilePath('robots.txt'));
});

app.get('/og-image.png', (_req, res) => {
  const imageBuffer = getOgPngBuffer();

  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.type('image/png');
  res.send(imageBuffer);
});

if (hasDatabaseConfig || hasDatabaseUrl) {
  const usuariosRoutes = require('./Entities/usuarios/usuarios.routes');
  const historialUsoRoutes = require('./Entities/historial_uso/historial_uso.routes');
  const maquinariaRoutes = require('./Entities/maquinaria/maquinaria.routes');
  const mantenimientosRoutes = require('./Entities/mantenimientos/mantenimientos.routes');
  const incidenciasRoutes = require('./Entities/incidencias/incidencias.routes');
  const reportesRoutes = require('./Entities/reportes/reportes.routes');
  const alertasCriticasRoutes = require('./Entities/alertas_criticas/alertas_criticas.routes');
  const notificacionesTiempoRealRoutes = require('./Entities/notificaciones_tiempo_real/notificaciones_tiempo_real.routes');
  const planesMantencionRoutes = require('./Entities/planes_mantencion/planes_mantencion.routes');
  const arriendosRoutes = require('./Entities/arriendos/arriendos.routes');
  const logisticaRoutes = require('./Entities/logistica/logistica.routes');
  const authRoutes = require('./Entities/auth/auth.routes');
  const roleRequestsRoutes = require('./Entities/role_requests/role_requests.routes');

  app.use('/api/usuarios', usuariosRoutes);
  app.use('/api/maquinaria', maquinariaRoutes);
  app.use('/api/mantenimientos', mantenimientosRoutes);
  app.use('/api/incidencias', incidenciasRoutes);
  app.use('/api/historial-uso', historialUsoRoutes);
  app.use('/api/reportes', reportesRoutes);
  app.use('/api/alertas-criticas', alertasCriticasRoutes);
  app.use('/api/notificaciones-tiempo-real', notificacionesTiempoRealRoutes);
  app.use('/api/planes-mantencion', planesMantencionRoutes);
  app.use('/api/arriendos', arriendosRoutes);
  app.use('/api/logistica', logisticaRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/role-requests', roleRequestsRoutes);
} else {
  app.use('/api', (_req, res) => {
    res.status(503).json({
      message: 'La base de datos no está configurada en este entorno. El frontend sigue disponible.'
    });
  });
}

app.use((err, _req, res, _next) => {
  console.error(err);

  if (isDatabaseUnavailableError(err)) {
    return res.status(503).json({ message: 'Base de datos no disponible. Intenta nuevamente en unos minutos.' });
  }

  res.status(500).json({ message: 'Error interno del servidor' });
});

// Fallback: cualquier ruta no encontrada que no sea API, servir index.html
app.use((_req, res) => {
  if (!_req.path.startsWith('/api')) {
    // Priorizar login como fallback público
    if (staticFileExists('login.html')) {
      return res.status(200).sendFile(staticFilePath('login.html'));
    }

    if (!staticFileExists('index.html')) {
      return res.status(500).json({ message: 'index.html no encontrado en frontend estático' });
    }

    return res.status(200).sendFile(staticFilePath('index.html'));
  }
  res.status(404).json({ message: 'Not found' });
});

module.exports = app;
