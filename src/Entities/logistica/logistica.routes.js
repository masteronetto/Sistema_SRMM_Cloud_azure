const { Router } = require('express');
const controller = require('./logistica.controller');
const { verifyToken, requireAdmin, requireOperadorOrAdmin } = require('../../middleware/auth');

const router = Router();

router.use(verifyToken);

router.get('/', controller.list);
router.post('/', requireAdmin, controller.create);
router.post('/:id_evento/retorno', requireOperadorOrAdmin, controller.createRetorno);
router.put('/:id_evento', requireOperadorOrAdmin, controller.update);
router.delete('/:id_evento', requireAdmin, controller.remove);

module.exports = router;