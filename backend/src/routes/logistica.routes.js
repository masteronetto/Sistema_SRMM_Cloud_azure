import { Router } from 'express';
import { requireAnyRole, requireAzureToken } from '../middleware/azureAuth.js';
import * as controller from '../domains/logistica/logistica.controller.js';

const router = Router();

router.use(requireAzureToken);
router.get('/', controller.listar);
router.post('/', requireAnyRole('Administrador', 'Operador'), controller.crear);
router.put('/:id_evento', requireAnyRole('Administrador', 'Operador'), controller.actualizar);
router.delete('/:id_evento', requireAnyRole('Administrador'), controller.eliminar);

export default router;
