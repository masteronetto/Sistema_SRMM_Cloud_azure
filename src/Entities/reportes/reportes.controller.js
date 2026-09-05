const reportesRepo = require('./reportes.repository');

async function obtenerHistorialMaquina(req, res, next) {
  try {
    const id_maquina = Number(req.params.id_maquina);
    const { fecha_inicio, fecha_fin } = req.query;

    if (!id_maquina || isNaN(id_maquina)) {
      return res.status(400).json({ message: 'id_maquina inválido' });
    }

    const data = await reportesRepo.getHistorialUnificado(id_maquina, fecha_inicio, fecha_fin);
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

async function obtenerTopMaquinas(req, res, next) {
  try {
    const data = await reportesRepo.getTopMaquinas();
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

async function obtenerEstadisticas(req, res, next) {
  try {
    const data = await reportesRepo.getEstadisticas();
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

async function obtenerUsoHistorico(req, res, next) {
  try {
    const id_maquina = Number(req.params.id_maquina);
    if (!id_maquina || isNaN(id_maquina)) {
      return res.status(400).json({ message: 'id_maquina inválido' });
    }
    const data = await reportesRepo.getUsoHistorico(id_maquina);
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

async function obtenerResumenOperador(req, res, next) {
  try {
    const idUsuario = Number(req.user?.id_usuario);
    if (!Number.isFinite(idUsuario)) {
      return res.status(400).json({ message: 'No se pudo identificar al usuario autenticado' });
    }

    const data = await reportesRepo.getResumenOperador(idUsuario);
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

async function obtenerActividadPorAutor(req, res, next) {
  try {
    const fechaInicio = typeof req.query.fecha_inicio === 'string' && req.query.fecha_inicio.trim() !== ''
      ? req.query.fecha_inicio.trim()
      : null;
    const fechaFin = typeof req.query.fecha_fin === 'string' && req.query.fecha_fin.trim() !== ''
      ? req.query.fecha_fin.trim()
      : null;

    const data = await reportesRepo.getActividadPorAutor({ fecha_inicio: fechaInicio, fecha_fin: fechaFin });
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

async function obtenerIngresos(req, res, next) {
  try {
    const { fecha_inicio, fecha_fin, tarifa } = req.query;
    const tarifa_diaria = tarifa ? Number(tarifa) : (process.env.ARRIENDO_RATE_DIA ? Number(process.env.ARRIENDO_RATE_DIA) : 100000);

    const data = await reportesRepo.getIngresosPorArriendos(fecha_inicio, fecha_fin, tarifa_diaria);
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

async function obtenerIngresosCsv(req, res, next) {
  try {
    const { fecha_inicio, fecha_fin, tarifa } = req.query;
    const tarifa_diaria = tarifa ? Number(tarifa) : (process.env.ARRIENDO_RATE_DIA ? Number(process.env.ARRIENDO_RATE_DIA) : 100000);

    const data = await reportesRepo.getIngresosPorArriendos(fecha_inicio, fecha_fin, tarifa_diaria);

    const escapeCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

    // Build CSV with metadata and summary
    const headers = ['id_maquina', 'modelo_equipo', 'contratos', 'dias_arrendados', 'tarifa_usada', 'ingresos'];
    const lines = [];

    lines.push('"meta_key","meta_value"');
    lines.push(`${escapeCsv('generado_en')},${escapeCsv(new Date().toISOString())}`);
    lines.push(`${escapeCsv('fecha_inicio')},${escapeCsv(fecha_inicio || 'from')}`);
    lines.push(`${escapeCsv('fecha_fin')},${escapeCsv(fecha_fin || 'to')}`);
    lines.push(`${escapeCsv('tarifa_diaria')},${escapeCsv(tarifa_diaria)}`);
    lines.push(`${escapeCsv('total_contratos')},${escapeCsv(data.total_contratos || 0)}`);
    lines.push(`${escapeCsv('total_dias_arrendados')},${escapeCsv(data.total_dias_arrendados || 0)}`);
    lines.push(`${escapeCsv('total_ingresos')},${escapeCsv(data.total_ingresos || 0)}`);
    lines.push('');
    lines.push(headers.map(escapeCsv).join(','));

    data.by_maquina.forEach(row => {
      const line = [
        row.id_maquina,
        row.modelo_equipo || '',
        row.contratos,
        row.dias_arrendados,
        row.tarifa_usada,
        row.ingresos
      ].map(escapeCsv).join(',');
      lines.push(line);
    });

    const csv = lines.join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="ingresos_arriendos_${fecha_inicio || 'from'}_${fecha_fin || 'to'}.csv"`);
    return res.send(csv);
  } catch (error) {
    return next(error);
  }
}

async function obtenerReporteFallas(req, res, next) {
  try {
    const periodo = typeof req.query.periodo === 'string' && req.query.periodo.trim() !== ''
      ? req.query.periodo.trim()
      : 'mensual';
    const criticidad = typeof req.query.criticidad === 'string' && req.query.criticidad.trim() !== ''
      ? req.query.criticidad.trim()
      : null;
    const mostrarAdvertencia = String(req.query.mostrar_advertencia || '').toLowerCase() === 'true';
    const maquinariaIds = typeof req.query.maquinaria_ids === 'string' && req.query.maquinaria_ids.trim() !== ''
      ? req.query.maquinaria_ids.split(',').map((value) => Number(value.trim())).filter((value) => Number.isFinite(value))
      : [];
    const fechaInicio = typeof req.query.fecha_inicio === 'string' && req.query.fecha_inicio.trim() !== ''
      ? req.query.fecha_inicio.trim()
      : null;
    const fechaFin = typeof req.query.fecha_fin === 'string' && req.query.fecha_fin.trim() !== ''
      ? req.query.fecha_fin.trim()
      : null;

    const data = await reportesRepo.getReporteFallas({
      periodo,
      criticidad,
      mostrar_advertencia: mostrarAdvertencia,
      maquinaria_ids: maquinariaIds,
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin
    });

    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

async function obtenerReporteFallasPropias(req, res, next) {
  try {
    const operadorId = Number(req.user?.id_usuario);
    if (!Number.isFinite(operadorId)) {
      return res.status(400).json({ message: 'No se pudo identificar al usuario autenticado' });
    }

    const periodo = typeof req.query.periodo === 'string' && req.query.periodo.trim() !== ''
      ? req.query.periodo.trim()
      : 'mensual';
    const criticidad = typeof req.query.criticidad === 'string' && req.query.criticidad.trim() !== ''
      ? req.query.criticidad.trim()
      : null;
    const mostrarAdvertencia = String(req.query.mostrar_advertencia || '').toLowerCase() === 'true';
    const maquinariaIds = typeof req.query.maquinaria_ids === 'string' && req.query.maquinaria_ids.trim() !== ''
      ? req.query.maquinaria_ids.split(',').map((value) => Number(value.trim())).filter((value) => Number.isFinite(value))
      : [];
    const fechaInicio = typeof req.query.fecha_inicio === 'string' && req.query.fecha_inicio.trim() !== ''
      ? req.query.fecha_inicio.trim()
      : null;
    const fechaFin = typeof req.query.fecha_fin === 'string' && req.query.fecha_fin.trim() !== ''
      ? req.query.fecha_fin.trim()
      : null;

    const data = await reportesRepo.getReporteFallas({
      periodo,
      criticidad,
      mostrar_advertencia: mostrarAdvertencia,
      maquinaria_ids: maquinariaIds,
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      operador_id: operadorId
    });

    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

async function obtenerReporteMantenimientos(req, res, next) {
  try {
    const data = await reportesRepo.getReporteMantenimientos();
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  obtenerHistorialMaquina,
  obtenerTopMaquinas,
  obtenerEstadisticas,
  obtenerUsoHistorico,
  obtenerResumenOperador,
  obtenerActividadPorAutor,
  obtenerIngresos,
  obtenerIngresosCsv,
  obtenerReporteFallas,
  obtenerReporteFallasPropias,
  obtenerReporteMantenimientos
};