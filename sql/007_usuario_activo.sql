-- Agregar columna activo para desactivación de usuarios sin eliminar
ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE;

-- Crear índice para búsquedas de usuarios activos
CREATE INDEX IF NOT EXISTS idx_usuarios_activo
ON usuarios (activo);

-- Comentario para documentar el propósito
COMMENT ON COLUMN usuarios.activo IS 'Indica si el usuario está activo (true) o ha sido desactivado (false) por un administrador';
