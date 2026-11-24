-- Integridad del dinero en la BD (defensa en profundidad; Zod ya valida en el servidor).
ALTER TABLE cuotas ADD CONSTRAINT cuotas_monto_positivo CHECK (monto_centavos > 0);
--> statement-breakpoint
ALTER TABLE pagos ADD CONSTRAINT pagos_monto_positivo CHECK (monto_centavos > 0);
--> statement-breakpoint
ALTER TABLE recargos ADD CONSTRAINT recargos_monto_no_negativo CHECK (monto_centavos >= 0);
--> statement-breakpoint
-- Un solo comprobante en revisión por cuota, aunque lleguen dos subidas a la vez.
CREATE UNIQUE INDEX IF NOT EXISTS pagos_un_pendiente_por_cuota ON pagos (cuota_id) WHERE estado = 'pendiente';
