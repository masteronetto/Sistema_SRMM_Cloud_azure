import * as service from './maquinaria.service.js';

export async function listar(_req, res, next) {
  try {
    return res.json(await service.listar());
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

export async function actualizar(req, res, next) {
  try {
    return res.json(await service.actualizar(req.params.id, req.body));
  } catch (error) {
    return next(error);
  }
}
