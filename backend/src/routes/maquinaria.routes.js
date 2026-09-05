import { Router } from 'express';
import { requireAzureToken } from '../middleware/azureAuth.js';

const router = Router();

function notImplemented(_req, res) {
  return res.status(501).json({
    message: 'El contrato de maquinaria esta definido, pero el repositorio cloud aun no esta conectado.'
  });
}

router.use(requireAzureToken);
router.get('/', notImplemented);
router.post('/', notImplemented);
router.put('/:id', notImplemented);

export default router;
