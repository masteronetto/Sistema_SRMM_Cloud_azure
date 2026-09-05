ALTER TABLE incidencias_maquina
    ADD COLUMN IF NOT EXISTS orden_trabajo_id BIGINT NULL;

    DO $$
    BEGIN
        IF NOT EXISTS (
                SELECT 1
                        FROM information_schema.table_constraints
                                WHERE constraint_name = 'fk_incidencia_orden_trabajo'
                                          AND table_name = 'incidencias_maquina'
                                              ) THEN
                                                      ALTER TABLE incidencias_maquina
                                                                  ADD CONSTRAINT fk_incidencia_orden_trabajo
                                                                              FOREIGN KEY (orden_trabajo_id)
                                                                                          REFERENCES ordenes_trabajo (id_orden)
                                                                                                      ON UPDATE CASCADE
                                                                                                                  ON DELETE SET NULL;
                                                                                                                      END IF;
                                                                                                                      END $$;

                                                                                                                      CREATE INDEX IF NOT EXISTS idx_incidencias_maquina_orden_trabajo
                                                                                                                      ON incidencias_maquina (orden_trabajo_id);
