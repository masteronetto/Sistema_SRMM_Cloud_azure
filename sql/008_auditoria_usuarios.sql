-- Auditoria de cambios sobre usuarios (altas, bajas y modificaciones)
CREATE TABLE IF NOT EXISTS auditoria_usuarios (
    id_auditoria BIGSERIAL PRIMARY KEY,
    tipo_operacion VARCHAR(50) NOT NULL,
    usuario_objetivo_id BIGINT NULL,
    ejecutado_por_id BIGINT NULL,
    detalle JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_auditoria_usuario_objetivo
        FOREIGN KEY (usuario_objetivo_id)
        REFERENCES usuarios (id_usuario)
        ON UPDATE CASCADE
        ON DELETE SET NULL,
    CONSTRAINT fk_auditoria_usuario_ejecutor
        FOREIGN KEY (ejecutado_por_id)
        REFERENCES usuarios (id_usuario)
        ON UPDATE CASCADE
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_auditoria_usuarios_created_at
ON auditoria_usuarios (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auditoria_usuarios_tipo_operacion
ON auditoria_usuarios (tipo_operacion);

CREATE INDEX IF NOT EXISTS idx_auditoria_usuarios_usuario_objetivo
ON auditoria_usuarios (usuario_objetivo_id);

CREATE INDEX IF NOT EXISTS idx_auditoria_usuarios_ejecutado_por
ON auditoria_usuarios (ejecutado_por_id);
