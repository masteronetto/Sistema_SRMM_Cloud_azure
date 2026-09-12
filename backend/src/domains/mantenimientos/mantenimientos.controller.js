import * as service from './mantenimientos.service.js';

export async function tiposServicio(_req, res, next) {
  try {
    return res.json({ data: await service.tiposServicio() });
  } catch (error) {
    return next(error);
  }
}

export async function historial(req, res, next) {
  try {
    const filters = {
      page: req.query.page,
      per_page: req.query.per_page,
      order: req.query.order,
      fecha_inicio: req.query.fecha_inicio,
      fecha_fin: req.query.fecha_fin,
      tipo_servicio: req.query.tipo_servicio
    };

    return res.json(await service.historialMaquina(req.params.id, filters));
  } catch (error) {
    return next(error);
  }
}
