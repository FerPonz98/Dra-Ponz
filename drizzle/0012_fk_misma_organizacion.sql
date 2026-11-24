-- Aislamiento también en las relaciones: RLS controla la organización de cada fila, pero una clave foránea
-- simple deja que la organización A cree una fila suya que apunte a un registro de B (Postgres comprueba las
-- FK sin RLS). Para cada FK entre tablas de negocio se agrega una FK compuesta (col, organizacion_id) →
-- padre(id, organizacion_id) con la misma acción de borrado. Las FK originales se mantienen (drizzle-kit).
CREATE OR REPLACE FUNCTION aplicar_fk_misma_organizacion() RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  f record;
  accion text;
BEGIN
  FOR f IN
    SELECT c.conname, c.conrelid::regclass::text AS hija, a.attname AS col, c.confrelid::regclass::text AS padre, c.confdeltype
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f' AND array_length(c.conkey, 1) = 1
      AND c.confrelid::regclass::text <> 'organizaciones'
      AND c.conname NOT LIKE '%_misma_org'
      AND EXISTS (SELECT 1 FROM information_schema.columns x WHERE x.table_schema = 'public' AND x.table_name = c.conrelid::regclass::text AND x.column_name = 'organizacion_id')
      AND EXISTS (SELECT 1 FROM information_schema.columns x WHERE x.table_schema = 'public' AND x.table_name = c.confrelid::regclass::text AND x.column_name = 'organizacion_id')
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = f.padre || '_id_org_uq') THEN
      EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I UNIQUE (id, organizacion_id)', f.padre, f.padre || '_id_org_uq');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = left(f.hija || '_' || f.col, 50) || '_misma_org') THEN
      accion := CASE f.confdeltype WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN format('SET NULL (%I)', f.col) ELSE 'NO ACTION' END;
      EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I, organizacion_id) REFERENCES %I (id, organizacion_id) ON DELETE %s',
        f.hija, left(f.hija || '_' || f.col, 50) || '_misma_org', f.col, f.padre, accion);
    END IF;
  END LOOP;
END;
$$;
--> statement-breakpoint
SELECT aplicar_fk_misma_organizacion();
