import * as service from './reportes.service.js';

export async function estadisticas(_req, res, next) {
  try {
    return res.json(await service.estadisticas());
  } catch (error) {
    return next(error);
  }
}

export async function topMaquinas(_req, res, next) {
  try {
    return res.json(await service.topMaquinas());
  } catch (error) {
    return next(error);
  }
}

export async function autores(req, res, next) {
  try {
    return res.json(await service.autores(req.query));
  } catch (error) {
    return next(error);
  }
}

export async function usoHistorico(req, res, next) {
  try {
    return res.json(await service.usoHistorico(req.params.id));
  } catch (error) {
    return next(error);
  }
}

export async function ingresos(req, res, next) {
  try {
    return res.json(await service.ingresos(req.query));
  } catch (error) {
    return next(error);
  }
}

export async function ingresosCsv(req, res, next) {
  try {
    const payload = await service.ingresos(req.query);
    const rows = payload.by_maquina.map((row) => ({
      maquina: row.modelo_equipo,
      contratos: row.contratos,
      ingresos: row.ingresos
    }));

    const header = ['maquina', 'contratos', 'ingresos'];
    const csv = [header.join(',')]
      .concat(rows.map((row) => `${row.maquina},${row.contratos},${row.ingresos}`))
      .join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="ingresos.csv"');
    return res.send(csv);
  } catch (error) {
    return next(error);
  }
}
