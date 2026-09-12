CREATE TABLE IF NOT EXISTS historial_horometro (
    id_registro BIGSERIAL PRIMARY KEY,
    valor_horas NUMERIC(12,2) NOT NULL CHECK (valor_horas >= 0),
    fecha_registro DATE NOT NULL DEFAULT CURRENT_DATE,
    maquinaria_id_maquina BIGINT NOT NULL,
    arriendos_id_contrato BIGINT NULL,
    id_usuario VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_historial_maquinaria
        FOREIGN KEY (maquinaria_id_maquina)
        REFERENCES maquinaria (id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT fk_historial_usuario
        FOREIGN KEY (id_usuario)
        REFERENCES identidad_usuario (oid)
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
    usuarios_id_usuario VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_mantenimiento_maquinaria
        FOREIGN KEY (maquinaria_id_maquina)
        REFERENCES maquinaria (id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT fk_mantenimiento_usuario
        FOREIGN KEY (usuarios_id_usuario)
        REFERENCES identidad_usuario (oid)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_mantenimiento_maquina_fecha
ON mantenimiento (maquinaria_id_maquina, fecha_servicio);

CREATE TABLE IF NOT EXISTS incidencias_maquina (
    id_incidencia BIGSERIAL PRIMARY KEY,
    maquinaria_id_maquina BIGINT NOT NULL,
    operador_id VARCHAR(64) NOT NULL,
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
        REFERENCES maquinaria (id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT fk_incidencia_operador
        FOREIGN KEY (operador_id)
        REFERENCES identidad_usuario (oid)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT chk_incidencia_criticidad
        CHECK (criticidad IN ('Alta', 'Media', 'Baja')),
    CONSTRAINT chk_incidencia_estado
        CHECK (estado IN ('Pendiente', 'Resuelta'))
);

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
