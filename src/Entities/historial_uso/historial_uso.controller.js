const historialUsoRepo = require('./historial_uso.repository');
const maquinariaRepo = require('../maquinaria/maquinaria.repository');
const alertasRepo = require('../alertas_criticas/alertas_criticas.repository');
const { enviarNotificacionAAdministradores } = require('../../config/socketio');
const pool = require('../../db/pool');

function toPositiveNumber(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

function normalizeRole(role) {
  return String(role || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizeDateInput(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmedValue = value.trim();
  const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!isoDatePattern.test(trimmedValue)) {
    return null;
  }

  const parsedDate = new Date(`${trimmedValue}T00:00:00Z`);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return trimmedValue;
}

function validateCreatePayload(payload) {
  const maquinaria_id_maquina = toPositiveNumber(payload.maquinaria_id_maquina);
  const valor_horas = toPositiveNumber(payload.valor_horas);
  const id_usuario = toPositiveNumber(payload.id_usuario);
  const arriendosRaw = payload.arriendos_id_contrato;
  const arriendos_id_contrato = arriendosRaw === undefined || arriendosRaw === null || arriendosRaw === ''
    ? null
    : toPositiveNumber(arriendosRaw);

  if (maquinaria_id_maquina === null || valor_horas === null || id_usuario === null) {
    return {
      error: 'Campos obligatorios y numericos: maquinaria_id_maquina, valor_horas, id_usuario',
      parsed: null
    };
  }

  if (arriendosRaw !== undefined && arriendosRaw !== null && arriendosRaw !== '' && arriendos_id_contrato === null) {
    return {
      error: 'arriendos_id_contrato debe ser numerico si se envia',
      parsed: null
    };
  }

  const fecha_registro = normalizeDateInput(payload.fecha_registro);
  if (payload.fecha_registro !== undefined && payload.fecha_registro !== null && payload.fecha_registro !== '' && fecha_registro === null) {
    return {
      error: 'fecha_registro debe tener formato YYYY-MM-DD si se envia',
      parsed: null
    };
  }

  return {
    error: null,
    parsed: {
      maquinaria_id_maquina,
      valor_horas,
      id_usuario,
      fecha_registro,
      arriendos_id_contrato
    }
  };
}

async function create(req, res, next) {
  try {
    const { error, parsed } = validateCreatePayload(req.body);
    if (error) {
      return res.status(400).json({ message: error });
    }

    const maquinaria = await maquinariaRepo.getMaquinariaById(parsed.maquinaria_id_maquina);
    if (!maquinaria) {
      return res.status(404).json({ message: 'Maquinaria no encontrada' });
    }

    const fechaRegistro = parsed.fecha_registro || new Date().toISOString().slice(0, 10);
    const historialExistente = await historialUsoRepo.getHistorialByMaquinaAndFecha(
      parsed.maquinaria_id_maquina,
      fechaRegistro
    );

    if (historialExistente) {
      return res.status(409).json({
        message: 'Ya existe un registro de horometro para esta maquinaria en la fecha indicada'
      });
    }

    // Si viene asociado a un arriendo, validar integridad: horometro_retorno >= horometro_salida
    if (parsed.arriendos_id_contrato) {
      const arriendoRes = await pool.query(
        'SELECT id_contrato, horometro_salida FROM arriendos WHERE id_contrato = $1 LIMIT 1',
        [parsed.arriendos_id_contrato]
      );
      const arriendo = arriendoRes.rows[0];
      if (!arriendo) {
        return res.status(400).json({ message: 'Contrato de arriendo no encontrado' });
      }
      if (Number(parsed.valor_horas) < Number(arriendo.horometro_salida)) {
        return res.status(400).json({ message: 'valor_horas (retorno) no puede ser menor que horometro_salida del contrato de arriendo' });
      }
    }

    if (Number(parsed.valor_horas) < Number(maquinaria.horometro_actual)) {
      return res.status(400).json({
        message: 'El valor_horas no puede ser menor al ultimo registro de la maquina'
      });
    }

    const client = await pool.connect();
    let pendingAdminSocketNotification = null;
    try {
      await client.query('BEGIN');

      const insertResult = await client.query(
        `
          INSERT INTO historial_horometro (maquinaria_id_maquina, valor_horas, id_usuario, fecha_registro, arriendos_id_contrato)
          VALUES ($1, $2, $3, COALESCE($4, CURRENT_DATE), $5)
          RETURNING id_registro, valor_horas, fecha_registro, maquinaria_id_maquina, arriendos_id_contrato, id_usuario, created_at
        `,
        [
          parsed.maquinaria_id_maquina,
          parsed.valor_horas,
          parsed.id_usuario,
          fechaRegistro,
          parsed.arriendos_id_contrato
        ]
      );

      const updatedMaquinaria = await client.query(
        `
          UPDATE maquinaria
          SET horometro_actual = $2,
              updated_at = NOW()
          WHERE id_maquina = $1
          RETURNING id_maquina
        `,
        [parsed.maquinaria_id_maquina, parsed.valor_horas]
      );

      if (updatedMaquinaria.rowCount === 0) {
        throw new Error('No fue posible actualizar la maquinaria');
      }

      // Verificar si se alcanzó el 100% del umbral crítico
      if (maquinaria.planes_mantencion_id_plan) {
        const planRes = await client.query(
          `SELECT id_plan, intervalo_horas FROM planes_mantencion WHERE id_plan = $1 LIMIT 1`,
          [maquinaria.planes_mantencion_id_plan]
        );
        const plan = planRes.rows[0];

        if (plan && plan.intervalo_horas) {
          // Obtener la referencia del último horometro (mantenimiento o historial)
          const refRes = await client.query(
            `
            SELECT COALESCE(
              (SELECT horometro_registro FROM mantenimiento 
               WHERE maquinaria_id_maquina = $1 
               ORDER BY fecha_servicio DESC, id_mantencion DESC LIMIT 1),
              (SELECT valor_horas FROM historial_horometro 
               WHERE maquinaria_id_maquina = $1 AND id_registro != (SELECT MAX(id_registro) FROM historial_horometro WHERE maquinaria_id_maquina = $1)
               ORDER BY fecha_registro DESC, id_registro DESC LIMIT 1),
              0
            ) as referencia
            `,
            [parsed.maquinaria_id_maquina]
          );

          const referencia = refRes.rows[0]?.referencia || 0;
          const horas_restantes = Number(referencia) + Number(plan.intervalo_horas) - Number(parsed.valor_horas);

          // Si se alcanzó el 100% (horas_restantes <= 0)
          if (horas_restantes <= 0) {
            // Crear alerta crítica si no existe una pendiente para la misma máquina.
            const alertaPendiente = await client.query(
              `
              SELECT id_alerta
              FROM alertas_criticas
              WHERE maquinaria_id_maquina = $1
                AND tipo_alerta = 'Critica'
                AND estado_alerta = 'Pendiente'
              ORDER BY created_at DESC
              LIMIT 1
              `,
              [parsed.maquinaria_id_maquina]
            );

            if (alertaPendiente.rowCount === 0) {
              await client.query(
                `
                INSERT INTO alertas_criticas (maquinaria_id_maquina, tipo_alerta, estado_alerta, porcentaje_umbral, horometro_critico, requiere_mantenimiento)
                VALUES ($1, 'Critica', 'Pendiente', 100, $2, TRUE)
                `,
                [parsed.maquinaria_id_maquina, parsed.valor_horas]
              );
            }

            // Crear incidencia automática de criticidad Alta (solo una pendiente por evento automático).
            const descripcionIncidenciaAuto = 'Alerta crítica automática: umbral de mantenimiento superado';
            const incidenciaPendiente = await client.query(
              `
              SELECT id_incidencia
              FROM incidencias_maquina
              WHERE maquinaria_id_maquina = $1
                AND criticidad = 'Alta'
                AND estado = 'Pendiente'
                AND descripcion = $2
              ORDER BY created_at DESC
              LIMIT 1
              `,
              [parsed.maquinaria_id_maquina, descripcionIncidenciaAuto]
            );

            if (incidenciaPendiente.rowCount === 0) {
              await client.query(
                `
                INSERT INTO incidencias_maquina (
                  maquinaria_id_maquina,
                  operador_id,
                  fecha,
                  descripcion,
                  criticidad,
                  vinculada_mantenimiento,
                  estado
                )
                VALUES ($1, $2, CURRENT_DATE, $3, 'Alta', TRUE, 'Pendiente')
                `,
                [parsed.maquinaria_id_maquina, parsed.id_usuario, descripcionIncidenciaAuto]
              );
            }

            // Bloquear la máquina automáticamente
            await client.query(
              `
              UPDATE maquinaria
              SET estado = 'Bloqueada',
                  updated_at = NOW()
              WHERE id_maquina = $1
              `,
              [parsed.maquinaria_id_maquina]
            );

            // Crear registro de bloqueo crítico
            await client.query(
              `
              INSERT INTO bloqueos_criticos (maquinaria_id_maquina, motivo_bloqueo, costo_estimado_reparacion, estado_bloqueo)
              VALUES ($1, 'Alerta crítica automática: se alcanzó el 100% del umbral de mantenimiento', 0, 'Activo')
              ON CONFLICT (maquinaria_id_maquina) DO UPDATE
              SET motivo_bloqueo = 'Alerta crítica automática: se alcanzó el 100% del umbral de mantenimiento',
                  estado_bloqueo = 'Activo',
                  updated_at = NOW()
              `,
              [parsed.maquinaria_id_maquina]
            );

            // Crear notificaciones dirigidas y persistentes para todos los administradores (transaccional).
            const adminRes = await client.query(
              `SELECT id_usuario FROM usuarios WHERE rol_acceso = 'Administrador'`
            );

            const prioridad = 'Alta';
            for (const admin of adminRes.rows) {
              await client.query(
                `
                INSERT INTO notificaciones_tiempo_real
                (admin_id, tipo_notificacion, maquina_id, nombre_maquina, prioridad, horas_restantes, detalles, leida, created_at)
                VALUES ($1, 'Alerta Critica', $2, $3, $4, $5, $6::jsonb, FALSE, NOW())
                `,
                [
                  admin.id_usuario,
                  parsed.maquinaria_id_maquina,
                  maquinaria.modelo_equipo,
                  prioridad,
                  horas_restantes,
                  JSON.stringify({
                    tipo_evento: 'Alerta Crítica Automática',
                    descripcion: 'Se alcanzó o superó el 100% del umbral de mantenimiento preventivo',
                    incidencia_automatica: true,
                    criticidad_incidencia: 'Alta',
                    referencia_alerta: 'SIS-12',
                    timestamp: new Date().toISOString()
                  })
                ]
              );
            }

            // Preparar notificación WebSocket para emisión post-commit.
            pendingAdminSocketNotification = {
              tipo: 'Alerta Critica',
              maquina_id: parsed.maquinaria_id_maquina,
              nombre_maquina: maquinaria.modelo_equipo,
              prioridad,
              horas_restantes,
              mensaje: `⚠️ ALERTA CRÍTICA: ${maquinaria.modelo_equipo} alcanzó el umbral de mantenimiento. Se creó incidencia Alta y la máquina fue bloqueada.`,
              timestamp: new Date().toISOString(),
              referencia_sistema: 'SIS-12'
            };
          }
        }
      }

      await client.query('COMMIT');

      const io = req.app.get('io');
      if (io && pendingAdminSocketNotification) {
        enviarNotificacionAAdministradores(io, pendingAdminSocketNotification);
        console.log('[historial_uso] Notificación WebSocket enviada a administradores');
      }

      return res.status(201).json(insertResult.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    if (error.code === '23503') {
      return res.status(400).json({ message: 'id_usuario no existe en usuarios' });
    }
    return next(error);
  }
}

async function createDiario(req, res, next) {
  try {
    const maquinaria_id_maquina = toPositiveNumber(req.body.maquinaria_id_maquina);
    const horas_dia = toPositiveNumber(req.body.horas_dia);
    const id_usuario = toPositiveNumber(req.user?.id_usuario);

    if (maquinaria_id_maquina === null || horas_dia === null || horas_dia <= 0) {
      return res.status(400).json({
        message: 'Campos obligatorios y numericos: maquinaria_id_maquina, horas_dia (debe ser mayor a 0)'
      });
    }

    if (id_usuario === null) {
      return res.status(400).json({ message: 'No se pudo identificar al usuario autenticado' });
    }

    const maquinaria = await maquinariaRepo.getMaquinariaById(maquinaria_id_maquina);
    if (!maquinaria) {
      return res.status(404).json({ message: 'Maquinaria no encontrada' });
    }

    const role = normalizeRole(req.user?.rol_acceso);
    if (role === 'operador') {
      const asignacionActiva = await maquinariaRepo.getAsignacionActivaByMaquina(maquinaria_id_maquina);
      if (!asignacionActiva || Number(asignacionActiva.operador_id) !== Number(id_usuario)) {
        return res.status(403).json({
          message: 'No tienes una asignacion activa para registrar horas en esta maquinaria'
        });
      }
    }

    const nuevoHorometro = Number(maquinaria.horometro_actual) + Number(horas_dia);
    const fecha_registro = new Date().toISOString().slice(0, 10);

    req.body = {
      maquinaria_id_maquina,
      valor_horas: nuevoHorometro,
      id_usuario,
      fecha_registro,
      arriendos_id_contrato: req.body.arriendos_id_contrato ?? null
    };

    return create(req, res, next);
  } catch (error) {
    return next(error);
  }
}

async function listByMaquina(req, res, next) {
  try {
    const maquinaria_id_maquina = toPositiveNumber(req.params.maquinaria_id_maquina);
    if (maquinaria_id_maquina === null) {
      return res.status(400).json({ message: 'maquinaria_id_maquina debe ser numerico y mayor o igual a 0' });
    }

    // Soporta paginación, orden y filtros (fecha desde/hasta, id_usuario)
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const perPage = Math.min(100, Math.max(1, parseInt(req.query.per_page || '10', 10)));
    const order = (req.query.order || 'desc').toLowerCase();
    const fecha_from = normalizeDateInput(req.query.fecha_from);
    const fecha_to = normalizeDateInput(req.query.fecha_to);
    const id_usuario = req.query.id_usuario ? toPositiveNumber(req.query.id_usuario) : null;

    const result = await historialUsoRepo.listHistorialByMaquinaPaged({
      maquinaria_id_maquina,
      page,
      perPage,
      order,
      fecha_from,
      fecha_to,
      id_usuario
    });

    return res.json({ data: result.rows, total: result.total, page, per_page: perPage });
  } catch (error) {
    return next(error);
  }
}

async function search(req, res, next) {
  try {
    const q = req.query.q || '';
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const perPage = Math.min(100, Math.max(1, parseInt(req.query.per_page || '10', 10)));
    const fecha_from = normalizeDateInput(req.query.fecha_from);
    const fecha_to = normalizeDateInput(req.query.fecha_to);
    const id_usuario = req.query.id_usuario ? toPositiveNumber(req.query.id_usuario) : null;

    const result = await historialUsoRepo.searchHistorial({ q, page, perPage, fecha_from, fecha_to, id_usuario });

    return res.json({ data: result.rows, total: result.total, page, per_page: perPage });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  create,
  createDiario,
  listByMaquina,
  search
};
