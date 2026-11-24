-- RLS para organizacion_tema + validación de formato en la BD (defensa en profundidad; Zod valida antes).
SELECT aplicar_rls();
--> statement-breakpoint
ALTER TABLE organizacion_tema ADD CONSTRAINT organizacion_tema_colores_hex CHECK (
  color_primario ~ '^#[0-9a-f]{6}$' AND color_secundario ~ '^#[0-9a-f]{6}$' AND color_acento ~ '^#[0-9a-f]{6}$'
  AND color_fondo ~ '^#[0-9a-f]{6}$' AND color_texto ~ '^#[0-9a-f]{6}$'
);
--> statement-breakpoint
ALTER TABLE organizacion_tema ADD CONSTRAINT organizacion_tema_radio CHECK (radio_bordes IN ('recto', 'suave', 'redondeado'));
