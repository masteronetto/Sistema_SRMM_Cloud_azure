const { Router } = require('express');
const controller = require('./alertas_criticas.controller');

const router = Router();

router.get('/:id_maquina/pendientes', controller.getAlertasPendientes);

router.get('/', controller.getAllertas);

router.patch('/:id_alerta/descartar', controller.descartar);

router.patch('/:id_alerta/resolver', controller.resolverAlerta);

module.exports = router;
