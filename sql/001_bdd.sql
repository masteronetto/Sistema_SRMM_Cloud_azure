CREATE TABLE IF NOT EXISTS usuarios (
    id_usuario BIGSERIAL PRIMARY KEY,
    nombre_completo VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    contrasena VARCHAR(255) NOT NULL,
    rol_acceso VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_rol_acceso
        CHECK (rol_acceso IN ('Administrador', 'Mecanico', 'Operador', 'Usuario'))
);

-- SIS-13: Tabla de planes de mantenimiento
CREATE TABLE IF NOT EXISTS planes_mantencion (
    id_plan BIGSERIAL PRIMARY KEY,
    nombre_plan VARCHAR(100) NOT NULL UNIQUE,
    intervalo_horas NUMERIC(12,2) NOT NULL CHECK (intervalo_horas > 0),
    descripcion TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_planes_mantencion_nombre
ON planes_mantencion (nombre_plan);

CREATE TABLE IF NOT EXISTS maquinaria (
    id_maquina BIGSERIAL PRIMARY KEY,
    modelo_equipo VARCHAR(120) NOT NULL,
    horometro_actual NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (horometro_actual >= 0),
    estado VARCHAR(20) NOT NULL DEFAULT 'Disponible',
    especificaciones TEXT,
    planes_mantencion_id_plan BIGINT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_maquinaria_estado
        CHECK (estado IN ('Disponible', 'Arrendada', 'Mantencion', 'Bloqueada', 'No Operativa'))
);

CREATE TABLE IF NOT EXISTS historial_horometro (
    id_registro BIGSERIAL PRIMARY KEY,
    valor_horas NUMERIC(12,2) NOT NULL CHECK (valor_horas >= 0),
    fecha_registro DATE NOT NULL DEFAULT CURRENT_DATE,
    maquinaria_id_maquina BIGINT NOT NULL,
    arriendos_id_contrato BIGINT NULL,
    id_usuario BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_historial_maquinaria
        FOREIGN KEY (maquinaria_id_maquina)
        REFERENCES maquinaria (id_maquina)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT fk_historial_usuario
        FOREIGN KEY (id_usuario)
        REFERENCES usuarios (id_usuario)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_historial_horometro_maquina_fecha
ON historial_horometro (maquinaria_id_maquina, fecha_registro);

CREATE TABLE IF NOT EXISTS mantenimiento (
    id_mantencion BIGSERIAL PRIMARY KEY,
    tipo_servicio VARCHAR(60) NOT NULL,
    horometro_registro NUMERIC(12,2) NOT NULL CHECK (horometro_registro >= 0),
    detalle_tecnico TEXT NOT NULL,
    fecha_servicio DATE NOT NULL DEFAULT CURRENT_DATE,
    maquinaria_id_maquina BIGINT NOT NULL,
    usuarios_id_usuario BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_mantenimiento_maquinaria
        FOREIGN KEY (maquinaria_id_maquina)
        REFERENCES maquinaria (id_maquina)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT fk_mantenimiento_usuario
        FOREIGN KEY (usuarios_id_usuario)
        REFERENCES usuarios (id_usuario)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_mantenimiento_maquina_fecha
ON mantenimiento (maquinaria_id_maquina, fecha_servicio);

CREATE TABLE IF NOT EXISTS ordenes_trabajo (
    id_orden BIGSERIAL PRIMARY KEY,
    maquinaria_id_maquina BIGINT NOT NULL,
    mecanico_asignado BIGINT NOT NULL,
    tipo_servicio VARCHAR(60) NOT NULL,
    detalle_tecnico TEXT NOT NULL,
    fecha_programada DATE NOT NULL,
    estado_ot VARCHAR(30) NOT NULL DEFAULT 'Programada',
    alerta_retraso_enviada BOOLEAN NOT NULL DEFAULT FALSE,
    estado_maquina_al_bloquear VARCHAR(20),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_orden_maquinaria
        FOREIGN KEY (maquinaria_id_maquina)
        REFERENCES maquinaria (id_maquina)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT fk_orden_mecanico
        FOREIGN KEY (mecanico_asignado)
        REFERENCES usuarios (id_usuario)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT chk_orden_estado
        CHECK (estado_ot IN ('Programada', 'En Progreso', 'Completada', 'Cancelada'))
);

CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_maquina
ON ordenes_trabajo (maquinaria_id_maquina, estado_ot);

CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_mecanico
ON ordenes_trabajo (mecanico_asignado, estado_ot);

CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_fecha
ON ordenes_trabajo (fecha_programada DESC);

CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_retraso
ON ordenes_trabajo (estado_ot, fecha_programada, alerta_retraso_enviada);

CREATE TABLE IF NOT EXISTS notificaciones (
    id_notificacion BIGSERIAL PRIMARY KEY,
    usuario_id BIGINT NOT NULL,
    tipo_notificacion VARCHAR(40) NOT NULL,
    referencia_id BIGINT,
    mensaje TEXT NOT NULL,
    leida BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_notificacion_usuario
        FOREIGN KEY (usuario_id)
        REFERENCES usuarios (id_usuario)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT chk_notificacion_tipo
        CHECK (tipo_notificacion IN ('Orden Trabajo', 'Alerta Critica', 'Bloqueo', 'Mantenimiento Completado'))
);

CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario_leida
ON notificaciones (usuario_id, leida);

CREATE TABLE IF NOT EXISTS bloqueos_criticos (
    id_bloqueo BIGSERIAL PRIMARY KEY,
    maquinaria_id_maquina BIGINT NOT NULL UNIQUE,
    motivo_bloqueo TEXT NOT NULL,
    costo_estimado_reparacion NUMERIC(12,2) NOT NULL DEFAULT 0,
    estado_bloqueo VARCHAR(20) NOT NULL DEFAULT 'Activo',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_bloqueo_maquinaria
        FOREIGN KEY (maquinaria_id_maquina)
        REFERENCES maquinaria (id_maquina)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT chk_bloqueo_estado
        CHECK (estado_bloqueo IN ('Activo', 'Resuelto'))
);

CREATE INDEX IF NOT EXISTS idx_bloqueos_criticos_maquina
ON bloqueos_criticos (maquinaria_id_maquina);

CREATE TABLE IF NOT EXISTS incidencias_maquina (
    id_incidencia BIGSERIAL PRIMARY KEY,
    maquinaria_id_maquina BIGINT NOT NULL,
    operador_id BIGINT NOT NULL,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    descripcion TEXT NOT NULL,
    criticidad VARCHAR(20) NOT NULL DEFAULT 'Media',
    vinculada_mantenimiento BOOLEAN NOT NULL DEFAULT FALSE,
    mantenimiento_id BIGINT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'Pendiente',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_incidencia_maquinaria
        FOREIGN KEY (maquinaria_id_maquina)
        REFERENCES maquinaria (id_maquina)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT fk_incidencia_operador
        FOREIGN KEY (operador_id)
        REFERENCES usuarios (id_usuario)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT fk_incidencia_mantenimiento
        FOREIGN KEY (mantenimiento_id)
        REFERENCES mantenimiento (id_mantencion)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT chk_incidencia_criticidad
        CHECK (criticidad IN ('Alta', 'Media', 'Baja')),
    CONSTRAINT chk_incidencia_estado
        CHECK (estado IN ('Pendiente', 'Resuelta'))
);

CREATE INDEX IF NOT EXISTS idx_incidencias_maquina_maquina
ON incidencias_maquina (maquinaria_id_maquina);

CREATE INDEX IF NOT EXISTS idx_incidencias_maquina_estado
ON incidencias_maquina (estado);

CREATE INDEX IF NOT EXISTS idx_incidencias_maquina_operador
ON incidencias_maquina (operador_id);

CREATE TABLE IF NOT EXISTS alertas_criticas (
    id_alerta BIGSERIAL PRIMARY KEY,
    maquinaria_id_maquina BIGINT NOT NULL,
    tipo_alerta VARCHAR(40) NOT NULL,
    estado_alerta VARCHAR(20) NOT NULL DEFAULT 'Pendiente',
    porcentaje_umbral NUMERIC(5,2) NOT NULL,
    horometro_critico NUMERIC(12,2) NOT NULL,
    requiere_mantenimiento BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_alerta_maquinaria
        FOREIGN KEY (maquinaria_id_maquina)
        REFERENCES maquinaria (id_maquina)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT chk_alerta_tipo
        CHECK (tipo_alerta IN ('Critica', 'Advertencia')),
    CONSTRAINT chk_alerta_estado
        CHECK (estado_alerta IN ('Pendiente', 'Descartada', 'Resuelta'))
);

CREATE INDEX IF NOT EXISTS idx_alertas_criticas_maquina
ON alertas_criticas (maquinaria_id_maquina, estado_alerta);

CREATE INDEX IF NOT EXISTS idx_alertas_criticas_timestamp
ON alertas_criticas (created_at DESC);

-- SIS-20: Tabla para notificaciones en tiempo real
CREATE TABLE IF NOT EXISTS notificaciones_tiempo_real (
    id_notificacion BIGSERIAL PRIMARY KEY,
    admin_id BIGINT NOT NULL,
    tipo_notificacion VARCHAR(40) NOT NULL,
    maquina_id BIGINT NOT NULL,
    nombre_maquina VARCHAR(120) NOT NULL,
    prioridad VARCHAR(20) NOT NULL,
    horas_restantes NUMERIC(12,2),
    detalles JSONB NOT NULL,
    leida BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_notif_admin
        FOREIGN KEY (admin_id)
        REFERENCES usuarios (id_usuario)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT fk_notif_maquina
        FOREIGN KEY (maquina_id)
        REFERENCES maquinaria (id_maquina)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT chk_notif_tipo
        CHECK (tipo_notificacion IN ('Alerta Critica', 'Orden Trabajo', 'Bloqueo')),
    CONSTRAINT chk_notif_prioridad
        CHECK (prioridad IN ('Alta', 'Media', 'Baja'))
);

CREATE INDEX IF NOT EXISTS idx_notif_admin_leida
ON notificaciones_tiempo_real (admin_id, leida);

CREATE INDEX IF NOT EXISTS idx_notif_timestamp
ON notificaciones_tiempo_real (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notif_maquina
ON notificaciones_tiempo_real (maquina_id);

-- Tabla para arriendos / contratos de arriendo (referenciada desde historial_horometro)
CREATE TABLE IF NOT EXISTS arriendos (
    id_contrato BIGSERIAL PRIMARY KEY,
    maquinaria_id_maquina BIGINT NOT NULL,
    cliente_id BIGINT NULL,
    horometro_entrada NUMERIC(12,2) NULL,
    horometro_salida NUMERIC(12,2) NULL,
    fecha_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_fin DATE NULL,
    estado_contrato VARCHAR(30) NOT NULL DEFAULT 'Activo',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_arriendos_maquina
        FOREIGN KEY (maquinaria_id_maquina)
        REFERENCES maquinaria (id_maquina)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT fk_arriendos_cliente
        FOREIGN KEY (cliente_id)
        REFERENCES usuarios (id_usuario)
        ON UPDATE CASCADE
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_arriendos_maquina ON arriendos (maquinaria_id_maquina);
CREATE INDEX IF NOT EXISTS idx_arriendos_cliente ON arriendos (cliente_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_arriendos_unico_activo_por_maquina
ON arriendos (maquinaria_id_maquina)
WHERE estado_contrato = 'Activo';

-- Tabla para solicitudes de cambio de rol (por usuarios)
CREATE TABLE IF NOT EXISTS role_requests (
    id_request BIGSERIAL PRIMARY KEY,
    usuario_id BIGINT NOT NULL,
    nombre_usuario VARCHAR(120),
    email_usuario VARCHAR(120) NOT NULL,
    mensaje TEXT,
    estado VARCHAR(30) NOT NULL DEFAULT 'Pendiente',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_role_request_usuario
        FOREIGN KEY (usuario_id)
        REFERENCES usuarios (id_usuario)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT chk_role_request_estado
        CHECK (estado IN ('Pendiente', 'Atendida', 'Rechazada'))
);

CREATE INDEX IF NOT EXISTS idx_role_requests_usuario ON role_requests (usuario_id);


CREATE OR REPLACE VIEW vista_historial_completo AS
SELECT 
    h.maquinaria_id_maquina,
    'Uso Diario' AS tipo_evento,
    h.valor_horas AS horometro,
    h.fecha_registro AS fecha_evento,
    u.nombre_completo AS usuario_responsable,
    'Registro de horas' AS detalle,
    h.created_at AS fecha_sistema  -- Agregado para ordenamiento más preciso
FROM historial_horometro h
JOIN usuarios u ON h.id_usuario = u.id_usuario

UNION ALL

SELECT 
    m.maquinaria_id_maquina,
    'Mantención: ' || m.tipo_servicio AS tipo_evento,
    m.horometro_registro AS horometro,
    m.fecha_servicio AS fecha_evento,
    u.nombre_completo AS usuario_responsable,
    m.detalle_tecnico AS detalle,
    m.created_at AS fecha_sistema
FROM mantenimiento m
JOIN usuarios u ON m.usuarios_id_usuario = u.id_usuario
ORDER BY fecha_evento DESC, fecha_sistema DESC;

BEGIN;

-- Agrega la columna si no existe
ALTER TABLE IF EXISTS maquinaria
  ADD COLUMN IF NOT EXISTS tarifa_diaria NUMERIC(12,2) DEFAULT NULL;

-- Inicializa las tarifas existentes con un valor estándar si todavía no tienen tarifa
UPDATE maquinaria
SET tarifa_diaria = 100000
WHERE tarifa_diaria IS NULL;

COMMIT;

CREATE TABLE IF NOT EXISTS logistica_eventos (
    id_evento BIGSERIAL PRIMARY KEY,
    maquinaria_id_maquina BIGINT NULL,
    titulo VARCHAR(160) NOT NULL,
    equipo VARCHAR(160) NOT NULL,
    cliente VARCHAR(160) NOT NULL,
    ruta VARCHAR(240) NOT NULL,
    hora_evento VARCHAR(40) NOT NULL,
    estado_evento VARCHAR(30) NOT NULL DEFAULT 'Pendiente',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_logistica_maquinaria
        FOREIGN KEY (maquinaria_id_maquina)
        REFERENCES maquinaria (id_maquina)
        ON UPDATE CASCADE
        ON DELETE SET NULL,
    CONSTRAINT chk_logistica_estado CHECK (estado_evento IN ('Pendiente', 'Confirmado', 'En Ruta', 'Completado', 'Cancelado'))
);

ALTER TABLE IF EXISTS logistica_eventos
    ADD COLUMN IF NOT EXISTS maquinaria_id_maquina BIGINT NULL;

CREATE INDEX IF NOT EXISTS idx_logistica_eventos_created_at ON logistica_eventos (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logistica_eventos_estado ON logistica_eventos (estado_evento);
CREATE INDEX IF NOT EXISTS idx_logistica_eventos_maquinaria ON logistica_eventos (maquinaria_id_maquina);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_logistica_maquinaria'
          AND table_name = 'logistica_eventos'
    ) THEN
        ALTER TABLE logistica_eventos
            ADD CONSTRAINT fk_logistica_maquinaria
            FOREIGN KEY (maquinaria_id_maquina)
            REFERENCES maquinaria (id_maquina)
            ON UPDATE CASCADE
            ON DELETE SET NULL;
    END IF;
END $$;

-- Migration: Add FK from maquinaria.planes_mantencion_id_plan -> planes_mantencion.id_plan
-- Backup recommended before running: pg_dump -t maquinaria -t planes_mantencion > backup_maquinaria_planes.sql

BEGIN;

-- Ensure referenced table/column exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'maquinaria' AND column_name = 'planes_mantencion_id_plan'
    ) THEN
        RAISE EXCEPTION 'Column maquinaria.planes_mantencion_id_plan does not exist';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'planes_mantencion' AND column_name = 'id_plan'
    ) THEN
        RAISE EXCEPTION 'Column planes_mantencion.id_plan does not exist';
    END IF;
END$$;

-- Add the foreign key constraint (use ON DELETE SET NULL to allow plan removal)
ALTER TABLE maquinaria
    ADD CONSTRAINT fk_maquinaria_planes_mantencion
    FOREIGN KEY (planes_mantencion_id_plan)
    REFERENCES planes_mantencion (id_plan)
    ON UPDATE CASCADE
    ON DELETE SET NULL;

COMMIT;
CREATE TABLE IF NOT EXISTS maquinaria_operadores (
    id_asignacion SERIAL PRIMARY KEY,
    maquinaria_id_maquina INTEGER NOT NULL REFERENCES maquinaria(id_maquina) ON DELETE CASCADE,
    operador_id INTEGER NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    fecha_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_fin DATE NULL,
    estado_asignacion VARCHAR(20) NOT NULL DEFAULT 'Activa' CHECK (estado_asignacion IN ('Activa', 'Finalizada')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maquinaria_operadores_maquina_estado
    ON maquinaria_operadores (maquinaria_id_maquina, estado_asignacion);

CREATE INDEX IF NOT EXISTS idx_maquinaria_operadores_operador_estado
    ON maquinaria_operadores (operador_id, estado_asignacion);

CREATE UNIQUE INDEX IF NOT EXISTS uq_maquinaria_operadores_activa_por_maquina
    ON maquinaria_operadores (maquinaria_id_maquina)
    WHERE estado_asignacion = 'Activa';
