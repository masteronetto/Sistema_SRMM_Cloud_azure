import { Router } from 'express';
import { requireAnyRole, requireAzureToken } from '../middleware/azureAuth.js';
import * as controller from '../domains/maquinaria/maquinaria.controller.js';

const router = Router();

router.use(requireAzureToken);
router.get('/', controller.listar);
router.post('/', requireAnyRole('Administrador'), controller.crear);
router.put('/:id', requireAnyRole('Administrador'), controller.actualizar);

export default router;
