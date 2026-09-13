CREATE TABLE IF NOT EXISTS identidad_usuario (
    oid VARCHAR(64) PRIMARY KEY,
    nombre VARCHAR(200) NOT NULL,
    correo VARCHAR(320) NOT NULL,
    ultimo_acceso TIMESTAMPTZ,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plan_mantenimiento (
    id BIGSERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    intervalo_horas NUMERIC(12,2) NOT NULL CHECK (intervalo_horas > 0),
    descripcion TEXT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS maquinaria (
    id BIGSERIAL PRIMARY KEY,
    modelo_equipo VARCHAR(120) NOT NULL CHECK (length(trim(modelo_equipo)) > 0),
    horometro_actual NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (horometro_actual >= 0),
    estado VARCHAR(20) NOT NULL DEFAULT 'Disponible' CHECK (estado IN ('Disponible', 'Arrendada', 'Mantencion', 'Bloqueada', 'No Operativa')),
    especificaciones TEXT,
    plan_mantenimiento_id BIGINT REFERENCES plan_mantenimiento(id) ON DELETE SET NULL,
    tarifa_diaria NUMERIC(14,2) CHECK (tarifa_diaria IS NULL OR tarifa_diaria >= 0),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maquinaria_estado ON maquinaria (estado);
CREATE INDEX IF NOT EXISTS idx_maquinaria_modelo ON maquinaria (modelo_equipo);

CREATE TABLE IF NOT EXISTS arriendos (
    id_contrato BIGSERIAL PRIMARY KEY,
    maquinaria_id_maquina BIGINT NOT NULL,
    cliente_id VARCHAR(64) NULL,
    fecha_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_fin DATE NULL,
    estado_contrato VARCHAR(30) NOT NULL DEFAULT 'Activo',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_arriendos_maquina
        FOREIGN KEY (maquinaria_id_maquina)
        REFERENCES maquinaria (id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT fk_arriendos_cliente
        FOREIGN KEY (cliente_id)
        REFERENCES identidad_usuario (oid)
        ON UPDATE CASCADE
        ON DELETE SET NULL,
    CONSTRAINT chk_arriendos_estado
        CHECK (estado_contrato IN ('Activo', 'Finalizado', 'Cancelado'))
);

CREATE INDEX IF NOT EXISTS idx_arriendos_maquina ON arriendos (maquinaria_id_maquina);

CREATE TABLE IF NOT EXISTS logistica_eventos (
    id_evento BIGSERIAL PRIMARY KEY,
    maquinaria_id_maquina BIGINT NULL,
    arriendos_id_contrato BIGINT NULL,
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
        REFERENCES maquinaria (id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,
    CONSTRAINT fk_logistica_arriendo
        FOREIGN KEY (arriendos_id_contrato)
        REFERENCES arriendos (id_contrato)
        ON UPDATE CASCADE
        ON DELETE SET NULL,
    CONSTRAINT chk_logistica_estado CHECK (estado_evento IN ('Pendiente', 'Confirmado', 'En Ruta', 'Completado', 'Cancelado'))
);

CREATE INDEX IF NOT EXISTS idx_logistica_eventos_created_at ON logistica_eventos (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logistica_eventos_estado ON logistica_eventos (estado_evento);
CREATE INDEX IF NOT EXISTS idx_logistica_eventos_maquinaria ON logistica_eventos (maquinaria_id_maquina);
CREATE INDEX IF NOT EXISTS idx_logistica_eventos_arriendo ON logistica_eventos (arriendos_id_contrato);
