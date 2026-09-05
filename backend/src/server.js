import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import apiRoutes from './routes/api.routes.js';
import maquinariaRoutes from './routes/maquinaria.routes.js';
import reportesRoutes from './routes/reportes.routes.js';
import mantenimientosRoutes from './routes/mantenimientos.routes.js';

const app = express();

app.use(helmet());
app.use(cors({ origin: env.frontendOrigin }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'srmm-bff',
    azureAuthConfigured: env.azureAuthEnabled
  });
});

app.use('/api', apiRoutes);
app.use('/api/maquinaria', maquinariaRoutes);
app.use('/api/reportes', reportesRoutes);
app.use('/api/mantenimientos', mantenimientosRoutes);

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ message: 'Error interno del BFF.' });
});

app.listen(env.port, () => {
  console.log(`SRMM BFF listening on http://localhost:${env.port}`);
});
