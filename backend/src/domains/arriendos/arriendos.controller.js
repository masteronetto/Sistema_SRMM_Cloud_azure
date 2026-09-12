import * as service from './arriendos.service.js';

export async function listar(_req, res, next) {
  try {
    return res.json(await service.listar());
  } catch (error) {
    return next(error);
  }
}

export async function misContratos(req, res, next) {
  try {
    const clienteId = req.auth?.oid || req.auth?.sub || req.params.cliente_id || req.auth?.preferred_username;
    return res.json(await service.misContratos(clienteId));
  } catch (error) {
    return next(error);
  }
}

export async function crear(req, res, next) {
  try {
    return res.status(201).json(await service.crear(req.body));
  } catch (error) {
    return next(error);
  }
}

export async function eliminar(req, res, next) {
  try {
    return res.json(await service.eliminar(req.params.id_contrato ?? req.params.id));
  } catch (error) {
    return next(error);
  }
}
