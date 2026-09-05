BEGIN;

ALTER TABLE IF EXISTS logistica_eventos
  ADD COLUMN IF NOT EXISTS arriendos_id_contrato BIGINT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
      SELECT 1
      FROM information_schema.table_constraints
      WHERE constraint_name = 'fk_logistica_arriendo'
        AND table_name = 'logistica_eventos'
  ) THEN
    ALTER TABLE logistica_eventos
      ADD CONSTRAINT fk_logistica_arriendo
      FOREIGN KEY (arriendos_id_contrato)
      REFERENCES arriendos (id_contrato)
      ON UPDATE CASCADE
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_logistica_eventos_arriendo
  ON logistica_eventos (arriendos_id_contrato);

COMMIT;
