-- Row Level Security: toda tabla de negocio con organizacion_id queda aislada por
-- current_setting('app.organizacion_id'). La función se reaplica en cada migración nueva.
CREATE OR REPLACE FUNCTION aplicar_rls() RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables tb ON tb.table_schema = c.table_schema AND tb.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND c.column_name = 'organizacion_id'
      AND tb.table_type = 'BASE TABLE'
      AND c.table_name NOT IN ('usuarios', 'sesiones', 'cuentas', 'verificaciones')
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t.table_name);
    EXECUTE format('DROP POLICY IF EXISTS aislamiento_organizacion ON %I', t.table_name);
    EXECUTE format(
      'CREATE POLICY aislamiento_organizacion ON %I USING (organizacion_id = nullif(current_setting(''app.organizacion_id'', true), '''')::uuid) WITH CHECK (organizacion_id = nullif(current_setting(''app.organizacion_id'', true), '''')::uuid)',
      t.table_name
    );
  END LOOP;
END;
$$;
--> statement-breakpoint
SELECT aplicar_rls();
--> statement-breakpoint
ALTER TABLE organizaciones ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS aislamiento_organizacion ON organizaciones;
--> statement-breakpoint
CREATE POLICY aislamiento_organizacion ON organizaciones
  USING (id = nullif(current_setting('app.organizacion_id', true), '')::uuid)
  WITH CHECK (id = nullif(current_setting('app.organizacion_id', true), '')::uuid);
