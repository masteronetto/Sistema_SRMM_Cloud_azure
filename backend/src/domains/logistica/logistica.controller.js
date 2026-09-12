import * as service from './logistica.service.js';

export async function listar(req, res, next) {
  try {
    const maquinariaIds = typeof req.query.maquinaria_ids === 'string' && req.query.maquinaria_ids.trim() !== ''
      ? req.query.maquinaria_ids.split(',').map((value) => Number(value.trim())).filter((value) => Number.isFinite(value) && value > 0)
      : [];

    return res.json(await service.listar({ maquinariaIds }));
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
    return res.json(await service.actualizar(req.params.id_evento, req.body));
  } catch (error) {
    return next(error);
  }
}

export async function eliminar(req, res, next) {
  try {
    return res.json(await service.eliminar(req.params.id_evento));
  } catch (error) {
    return next(error);
  }
}
