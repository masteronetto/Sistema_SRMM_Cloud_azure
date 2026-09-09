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
