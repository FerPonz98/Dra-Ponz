CREATE TABLE "organizacion_tema" (
	"organizacion_id" uuid PRIMARY KEY NOT NULL,
	"color_primario" text NOT NULL,
	"color_secundario" text NOT NULL,
	"color_acento" text NOT NULL,
	"color_fondo" text NOT NULL,
	"color_texto" text NOT NULL,
	"fuente_titulos" text NOT NULL,
	"fuente_texto" text NOT NULL,
	"radio_bordes" text NOT NULL,
	"preset" text,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organizacion_tema" ADD CONSTRAINT "organizacion_tema_organizacion_id_organizaciones_id_fk" FOREIGN KEY ("organizacion_id") REFERENCES "public"."organizaciones"("id") ON DELETE cascade ON UPDATE no action;