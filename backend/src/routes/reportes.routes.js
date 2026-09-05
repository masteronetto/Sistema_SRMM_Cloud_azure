import { Router } from 'express';
import { requireAzureToken } from '../middleware/azureAuth.js';

const router = Router();
const pending = (_req, res) => res.status(501).json({ message: 'El contrato de reportes esta definido, pero el repositorio cloud aun no esta conectado.' });

router.use(requireAzureToken);
router.get('/estadisticas', pending);
router.get('/top-maquinas', pending);
router.get('/autores', pending);
router.get('/uso-historico/:id', pending);
router.get('/ingresos', pending);
router.get('/ingresos/csv', pending);

export default router;
