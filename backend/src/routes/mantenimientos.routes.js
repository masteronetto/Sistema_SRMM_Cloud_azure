import { Router } from 'express';
import { requireAzureToken } from '../middleware/azureAuth.js';
import * as controller from '../domains/mantenimientos/mantenimientos.controller.js';

const router = Router();

router.use(requireAzureToken);
router.get('/tipos-servicio', controller.tiposServicio);
router.get('/maquina/:id/historial', controller.historial);

export default router;
