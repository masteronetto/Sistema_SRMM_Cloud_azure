import { Router } from 'express';
import { requireAnyRole, requireAzureToken } from '../middleware/azureAuth.js';

const router = Router();
const pending = (_req, res) => res.status(501).json({ message: 'El contrato de reportes esta definido, pero el repositorio cloud aun no esta conectado.' });

router.use(requireAzureToken);
router.get('/estadisticas', pending);
router.get('/top-maquinas', pending);
router.get('/autores', requireAnyRole('Administrador', 'Mecanico'), pending);
router.get('/uso-historico/:id', pending);
router.get('/ingresos', requireAnyRole('Administrador'), pending);
router.get('/ingresos/csv', requireAnyRole('Administrador'), pending);

export default router;
