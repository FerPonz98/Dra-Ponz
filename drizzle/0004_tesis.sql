CREATE TABLE "actividades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacion_id" uuid NOT NULL,
	"cronograma_id" uuid NOT NULL,
	"orden" integer NOT NULL,
	"nombre" text NOT NULL,
	"meses" integer[] NOT NULL,
	"a_cargo_estudiante" boolean DEFAULT false NOT NULL,
	"hecha" boolean DEFAULT false NOT NULL,
	"hecha_en" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "archivos_proyecto" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacion_id" uuid NOT NULL,
	"propuesta_id" uuid NOT NULL,
	"archivo_id" uuid NOT NULL,
	"origen" text NOT NULL,
	"descripcion" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cronogramas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacion_id" uuid NOT NULL,
	"propuesta_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"fecha_inicio" date NOT NULL,
	"meses" integer NOT NULL,
	"estado" text DEFAULT 'propuesto' NOT NULL,
	"aceptado_en" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extras_catalogo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacion_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"precio_centavos" integer NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "formulario_campos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacion_id" uuid NOT NULL,
	"formulario_id" uuid NOT NULL,
	"orden" integer NOT NULL,
	"tipo" text NOT NULL,
	"etiqueta" text NOT NULL,
	"ayuda" text,
	"obligatorio" boolean DEFAULT false NOT NULL,
	"opciones" text[] DEFAULT '{}'::text[] NOT NULL
);
--> statement-breakpoint
CREATE TABLE "formularios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacion_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"descripcion" text,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "historial_propuesta" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacion_id" uuid NOT NULL,
	"propuesta_id" uuid NOT NULL,
	"evento" text NOT NULL,
	"detalle" text,
	"usuario_nombre" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "propuesta_extras" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacion_id" uuid NOT NULL,
	"propuesta_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"precio_centavos" integer NOT NULL,
	"estado" text DEFAULT 'ofrecido' NOT NULL,
	"cuota_id" uuid,
	"solicitado_en" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "propuestas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacion_id" uuid NOT NULL,
	"cliente_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"titulo" text NOT NULL,
	"universidad" text,
	"nivel" text DEFAULT 'pregrado' NOT NULL,
	"estado" text DEFAULT 'borrador' NOT NULL,
	"precio_tercera_revision_centavos" integer DEFAULT 0 NOT NULL,
	"formulario_id" uuid,
	"vigencia_dias" integer DEFAULT 7 NOT NULL,
	"enviada_en" timestamp with time zone,
	"expira_en" timestamp with time zone,
	"aceptada_en" timestamp with time zone,
	"requiere_nuevo_cronograma" boolean DEFAULT false NOT NULL,
	"veces_enviada" integer DEFAULT 0 NOT NULL,
	"notas" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "respuestas_formulario" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacion_id" uuid NOT NULL,
	"propuesta_id" uuid NOT NULL,
	"formulario_id" uuid NOT NULL,
	"valores" jsonb NOT NULL,
	"enviado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "revisiones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacion_id" uuid NOT NULL,
	"propuesta_id" uuid NOT NULL,
	"numero" integer NOT NULL,
	"incluida" boolean NOT NULL,
	"precio_centavos" integer DEFAULT 0 NOT NULL,
	"estado" text DEFAULT 'pendiente' NOT NULL,
	"cuota_id" uuid,
	"solicitada_en" timestamp with time zone,
	"hecha_en" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "actividades" ADD CONSTRAINT "actividades_organizacion_id_organizaciones_id_fk" FOREIGN KEY ("organizacion_id") REFERENCES "public"."organizaciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actividades" ADD CONSTRAINT "actividades_cronograma_id_cronogramas_id_fk" FOREIGN KEY ("cronograma_id") REFERENCES "public"."cronogramas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "archivos_proyecto" ADD CONSTRAINT "archivos_proyecto_organizacion_id_organizaciones_id_fk" FOREIGN KEY ("organizacion_id") REFERENCES "public"."organizaciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "archivos_proyecto" ADD CONSTRAINT "archivos_proyecto_propuesta_id_propuestas_id_fk" FOREIGN KEY ("propuesta_id") REFERENCES "public"."propuestas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "archivos_proyecto" ADD CONSTRAINT "archivos_proyecto_archivo_id_archivos_id_fk" FOREIGN KEY ("archivo_id") REFERENCES "public"."archivos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cronogramas" ADD CONSTRAINT "cronogramas_organizacion_id_organizaciones_id_fk" FOREIGN KEY ("organizacion_id") REFERENCES "public"."organizaciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cronogramas" ADD CONSTRAINT "cronogramas_propuesta_id_propuestas_id_fk" FOREIGN KEY ("propuesta_id") REFERENCES "public"."propuestas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extras_catalogo" ADD CONSTRAINT "extras_catalogo_organizacion_id_organizaciones_id_fk" FOREIGN KEY ("organizacion_id") REFERENCES "public"."organizaciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "formulario_campos" ADD CONSTRAINT "formulario_campos_organizacion_id_organizaciones_id_fk" FOREIGN KEY ("organizacion_id") REFERENCES "public"."organizaciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "formulario_campos" ADD CONSTRAINT "formulario_campos_formulario_id_formularios_id_fk" FOREIGN KEY ("formulario_id") REFERENCES "public"."formularios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "formularios" ADD CONSTRAINT "formularios_organizacion_id_organizaciones_id_fk" FOREIGN KEY ("organizacion_id") REFERENCES "public"."organizaciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historial_propuesta" ADD CONSTRAINT "historial_propuesta_organizacion_id_organizaciones_id_fk" FOREIGN KEY ("organizacion_id") REFERENCES "public"."organizaciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historial_propuesta" ADD CONSTRAINT "historial_propuesta_propuesta_id_propuestas_id_fk" FOREIGN KEY ("propuesta_id") REFERENCES "public"."propuestas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "propuesta_extras" ADD CONSTRAINT "propuesta_extras_organizacion_id_organizaciones_id_fk" FOREIGN KEY ("organizacion_id") REFERENCES "public"."organizaciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "propuesta_extras" ADD CONSTRAINT "propuesta_extras_propuesta_id_propuestas_id_fk" FOREIGN KEY ("propuesta_id") REFERENCES "public"."propuestas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "propuesta_extras" ADD CONSTRAINT "propuesta_extras_cuota_id_cuotas_id_fk" FOREIGN KEY ("cuota_id") REFERENCES "public"."cuotas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "propuestas" ADD CONSTRAINT "propuestas_organizacion_id_organizaciones_id_fk" FOREIGN KEY ("organizacion_id") REFERENCES "public"."organizaciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "propuestas" ADD CONSTRAINT "propuestas_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "propuestas" ADD CONSTRAINT "propuestas_plan_id_planes_pago_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."planes_pago"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "propuestas" ADD CONSTRAINT "propuestas_formulario_id_formularios_id_fk" FOREIGN KEY ("formulario_id") REFERENCES "public"."formularios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "respuestas_formulario" ADD CONSTRAINT "respuestas_formulario_organizacion_id_organizaciones_id_fk" FOREIGN KEY ("organizacion_id") REFERENCES "public"."organizaciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "respuestas_formulario" ADD CONSTRAINT "respuestas_formulario_propuesta_id_propuestas_id_fk" FOREIGN KEY ("propuesta_id") REFERENCES "public"."propuestas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "respuestas_formulario" ADD CONSTRAINT "respuestas_formulario_formulario_id_formularios_id_fk" FOREIGN KEY ("formulario_id") REFERENCES "public"."formularios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revisiones" ADD CONSTRAINT "revisiones_organizacion_id_organizaciones_id_fk" FOREIGN KEY ("organizacion_id") REFERENCES "public"."organizaciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revisiones" ADD CONSTRAINT "revisiones_propuesta_id_propuestas_id_fk" FOREIGN KEY ("propuesta_id") REFERENCES "public"."propuestas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revisiones" ADD CONSTRAINT "revisiones_cuota_id_cuotas_id_fk" FOREIGN KEY ("cuota_id") REFERENCES "public"."cuotas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "actividades_cronograma_idx" ON "actividades" USING btree ("cronograma_id","orden");--> statement-breakpoint
CREATE INDEX "archivos_proyecto_idx" ON "archivos_proyecto" USING btree ("propuesta_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cronogramas_propuesta_version_uq" ON "cronogramas" USING btree ("propuesta_id","version");--> statement-breakpoint
CREATE INDEX "campos_formulario_idx" ON "formulario_campos" USING btree ("formulario_id","orden");--> statement-breakpoint
CREATE INDEX "historial_propuesta_idx" ON "historial_propuesta" USING btree ("propuesta_id","creado_en");--> statement-breakpoint
CREATE INDEX "propuestas_org_estado_idx" ON "propuestas" USING btree ("organizacion_id","estado");--> statement-breakpoint
CREATE UNIQUE INDEX "propuestas_plan_uq" ON "propuestas" USING btree ("plan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "respuestas_propuesta_formulario_uq" ON "respuestas_formulario" USING btree ("propuesta_id","formulario_id");--> statement-breakpoint
CREATE UNIQUE INDEX "revisiones_propuesta_numero_uq" ON "revisiones" USING btree ("propuesta_id","numero");