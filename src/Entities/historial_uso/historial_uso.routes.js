const { Router } = require('express');
const controller = require('./historial_uso.controller');
const { verifyToken, requireMecanicoOperadorOrAdmin, requireOperadorOrAdmin, requireActiveUser } = require('../../middleware/auth');

const router = Router();

router.use(verifyToken);
router.use(requireActiveUser);

router.post('/', requireMecanicoOperadorOrAdmin, controller.create);
router.post('/diario', requireOperadorOrAdmin, controller.createDiario);
router.get('/maquina/:maquinaria_id_maquina', requireMecanicoOperadorOrAdmin, controller.listByMaquina);
router.get('/search', requireMecanicoOperadorOrAdmin, controller.search);

module.exports = router;
