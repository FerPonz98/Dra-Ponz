ALTER TABLE "organizacion_tema" ADD COLUMN "intro_activa" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "organizaciones" ADD COLUMN "isotipo_archivo_id" uuid;