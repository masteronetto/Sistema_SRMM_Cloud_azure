const { Router } = require('express');
const controller = require('./auth.controller');
const { verifyToken, requireActiveUser, requireAdmin } = require('../../middleware/auth');

const router = Router();

router.post('/login', controller.login);
router.post('/register', controller.register);
router.post('/recover', controller.recover);
router.post('/reset', controller.resetPassword);
router.get('/recovery-attempts', verifyToken, requireActiveUser, requireAdmin, controller.listRecoveryAttempts);

module.exports = router;
