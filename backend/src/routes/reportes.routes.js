import { Router } from 'express';
import { requireAnyRole, requireAzureToken } from '../middleware/azureAuth.js';
import * as controller from '../domains/reportes/reportes.controller.js';

const router = Router();

router.use(requireAzureToken);
router.get('/estadisticas', controller.estadisticas);
router.get('/top-maquinas', controller.topMaquinas);
router.get('/autores', requireAnyRole('Administrador', 'Mecanico'), controller.autores);
router.get('/uso-historico/:id', controller.usoHistorico);
router.get('/ingresos', requireAnyRole('Administrador'), controller.ingresos);
router.get('/ingresos/csv', requireAnyRole('Administrador'), controller.ingresosCsv);

export default router;
