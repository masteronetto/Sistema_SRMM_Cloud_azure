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

