-- Registro de intentos de recuperacion de contrasena
CREATE TABLE IF NOT EXISTS intentos_recuperacion (
    id_intento BIGSERIAL PRIMARY KEY,
    email_solicitante VARCHAR(100) NOT NULL,
    ip_solicitante VARCHAR(120) NOT NULL,
    user_agent TEXT,
    estado_intento VARCHAR(30) NOT NULL,
    detalle TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intentos_recuperacion_created_at
ON intentos_recuperacion (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_intentos_recuperacion_email
ON intentos_recuperacion (email_solicitante);

CREATE INDEX IF NOT EXISTS idx_intentos_recuperacion_ip
ON intentos_recuperacion (ip_solicitante);
