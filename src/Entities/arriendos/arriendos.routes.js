const { Router } = require('express');
const controller = require('./arriendos.controller');
const { verifyToken, requireAdmin, requireActiveUser } = require('../../middleware/auth');

const router = Router();

router.use(verifyToken);
router.use(requireActiveUser);

router.get('/', controller.listContratos);
router.get('/mis-contratos', controller.listMisContratos);
router.post('/', requireAdmin, controller.createContrato);
router.delete('/:id_contrato', requireAdmin, controller.deleteContrato);

module.exports = router;