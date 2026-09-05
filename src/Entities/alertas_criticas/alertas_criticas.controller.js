const alertasRepo = require('./alertas_criticas.repository');

function toNumberOrNull(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

async function getAlertasPendientes(req, res, next) {
  try {
    const id_maquina = toNumberOrNull(req.params.id_maquina);
    if (id_maquina === null) {
      return res.status(400).json({ message: 'id_maquina debe ser numerico' });
    }

    const alertas = await alertasRepo.getAlertasPendientesByMaquina(id_maquina);
    return res.json(alertas);
  } catch (error) {
    return next(error);
  }
}

async function getAllertas(req, res, next) {
  try {
    const limitRaw = req.query.limit || '50';
    const offsetRaw = req.query.offset || '0';
    const estadoRaw = typeof req.query.estado === 'string' ? req.query.estado.trim() : 'Pendiente';

    const limit = toNumberOrNull(limitRaw);
    const offset = toNumberOrNull(offsetRaw);

    if (limit === null || offset === null) {
      return res.status(400).json({ message: 'limit y offset deben ser numéricos' });
    }

    const alertas = await alertasRepo.getAllertasAll(limit, offset, estadoRaw || 'Pendiente');
    return res.json(alertas);
  } catch (error) {
    return next(error);
  }
}

async function descartar(req, res, next) {
  try {
    const id_alerta = toNumberOrNull(req.params.id_alerta);
    if (id_alerta === null) {
      return res.status(400).json({ message: 'id_alerta debe ser numerico' });
    }

    const alerta = await alertasRepo.descartar(id_alerta);
    if (!alerta) {
      return res.status(404).json({ message: 'Alerta no encontrada' });
    }

    return res.json({
      message: 'Alerta descartada',
      alerta
    });
  } catch (error) {
    return next(error);
  }
}

async function resolverAlerta(req, res, next) {
  try {
    const id_alerta = toNumberOrNull(req.params.id_alerta);
    if (id_alerta === null) {
      return res.status(400).json({ message: 'id_alerta debe ser numerico' });
    }

    const alerta = await alertasRepo.resolverAlerta(id_alerta);
    if (!alerta) {
      return res.status(404).json({ message: 'Alerta no encontrada' });
    }

    return res.json({
      message: 'Alerta resuelta tras completar mantenimiento',
      alerta
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getAlertasPendientes,
  getAllertas,
  descartar,
  resolverAlerta
};
