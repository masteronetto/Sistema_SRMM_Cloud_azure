import { Router } from 'express';
import { requireAzureToken } from '../middleware/azureAuth.js';

const router = Router();
const pending = (_req, res) => res.status(501).json({ message: 'El contrato de mantenimientos esta definido, pero el repositorio cloud aun no esta conectado.' });

router.use(requireAzureToken);
router.get('/tipos-servicio', pending);
router.get('/maquina/:id/historial', pending);

export default router;
