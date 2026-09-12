import { Router } from 'express';
import { requireAnyRole, requireAzureToken } from '../middleware/azureAuth.js';
import * as controller from '../domains/usuarios/usuarios.controller.js';

const router = Router();

router.use(requireAzureToken);
router.get('/', requireAnyRole('Administrador'), controller.listar);
router.post('/', requireAnyRole('Administrador'), controller.crear);
router.put('/:oid', requireAnyRole('Administrador'), controller.actualizar);
router.patch('/:oid', requireAnyRole('Administrador'), controller.actualizar);
router.delete('/:oid', requireAnyRole('Administrador'), controller.eliminar);

export default router;
