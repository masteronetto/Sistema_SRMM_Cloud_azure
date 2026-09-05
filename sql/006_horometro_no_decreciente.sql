-- Evita que el horometro disminuya en actualizaciones directas de maquinaria.
CREATE OR REPLACE FUNCTION validar_horometro_no_decreciente()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.horometro_actual < OLD.horometro_actual THEN
    RAISE EXCEPTION 'El horometro_actual no puede ser menor al valor previamente registrado'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_horometro_no_decreciente ON maquinaria;

CREATE TRIGGER trg_validar_horometro_no_decreciente
BEFORE UPDATE OF horometro_actual ON maquinaria
FOR EACH ROW
EXECUTE FUNCTION validar_horometro_no_decreciente();
