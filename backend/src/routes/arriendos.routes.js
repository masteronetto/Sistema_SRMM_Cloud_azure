import { Router } from 'express';
import { requireAnyRole, requireAzureToken } from '../middleware/azureAuth.js';
import * as controller from '../domains/arriendos/arriendos.controller.js';

const router = Router();

router.use(requireAzureToken);
router.get('/', controller.listar);
router.get('/mis-contratos', controller.misContratos);
router.post('/', requireAnyRole('Administrador'), controller.crear);
router.delete('/:id_contrato', requireAnyRole('Administrador'), controller.eliminar);

export default router;
