CREATE TABLE "clientes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacion_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"ci" text,
	"whatsapp" text,
	"correo" text,
	"notas" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cuotas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacion_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"numero" integer NOT NULL,
	"concepto" text,
	"monto_centavos" integer NOT NULL,
	"fecha_vencimiento" date NOT NULL,
	"estado" text DEFAULT 'pendiente' NOT NULL,
	"pagada_en" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enlaces_portal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacion_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"token" text,
	"metodo" text NOT NULL,
	"ci" text,
	"pin_hash" text,
	"intentos_fallidos" integer DEFAULT 0 NOT NULL,
	"bloqueado_hasta" timestamp with time zone,
	"expira_en" timestamp with time zone,
	"anulado_en" timestamp with time zone,
	"referencia_tipo" text,
	"referencia_id" uuid,
	"ultimo_acceso_en" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "enlaces_portal_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "historial_plan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacion_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"cuota_id" uuid,
	"usuario_id" text,
	"usuario_nombre" text,
	"campo" text NOT NULL,
	"valor_antes" text,
	"valor_despues" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pagos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacion_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"cuota_id" uuid NOT NULL,
	"enlace_id" uuid,
	"moneda" text NOT NULL,
	"monto_centavos" integer NOT NULL,
	"tipo_cambio" numeric(12, 5),
	"tipo_cambio_fecha" date,
	"monto_bob_centavos" integer NOT NULL,
	"comprobante_archivo_id" uuid,
	"estado" text DEFAULT 'pendiente' NOT NULL,
	"motivo_rechazo" text,
	"revisado_por" text,
	"revisado_en" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "planes_pago" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacion_id" uuid NOT NULL,
	"cliente_id" uuid NOT NULL,
	"titulo" text NOT NULL,
	"moneda" text DEFAULT 'BOB' NOT NULL,
	"estado" text DEFAULT 'activo' NOT NULL,
	"estado_mora" text DEFAULT 'al_dia' NOT NULL,
	"aceptado_en" timestamp with time zone,
	"plazo_primera_cuota_dias" integer,
	"dias_gracia" integer,
	"recargo_activo" boolean DEFAULT false NOT NULL,
	"recargo_porcentaje" numeric(6, 2),
	"recargo_modo" text DEFAULT 'unico' NOT NULL,
	"dias_gracia_nueva_mora" integer,
	"numero_moras" integer DEFAULT 0 NOT NULL,
	"origen" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plantillas_mensaje" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacion_id" uuid NOT NULL,
	"clave" text NOT NULL,
	"titulo" text NOT NULL,
	"cuerpo" text NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recargos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacion_id" uuid NOT NULL,
	"cuota_id" uuid NOT NULL,
	"numero" integer NOT NULL,
	"porcentaje" numeric(6, 2) NOT NULL,
	"monto_centavos" integer NOT NULL,
	"aplicado_en" date NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recordatorios_enviados" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacion_id" uuid NOT NULL,
	"cuota_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"canal" text DEFAULT 'correo' NOT NULL,
	"fecha" date NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tipos_cambio" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fecha" date NOT NULL,
	"moneda" text NOT NULL,
	"valor" numeric(12, 5) NOT NULL,
	"fuente" text DEFAULT 'BCB' NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_organizacion_id_organizaciones_id_fk" FOREIGN KEY ("organizacion_id") REFERENCES "public"."organizaciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cuotas" ADD CONSTRAINT "cuotas_organizacion_id_organizaciones_id_fk" FOREIGN KEY ("organizacion_id") REFERENCES "public"."organizaciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cuotas" ADD CONSTRAINT "cuotas_plan_id_planes_pago_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."planes_pago"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enlaces_portal" ADD CONSTRAINT "enlaces_portal_organizacion_id_organizaciones_id_fk" FOREIGN KEY ("organizacion_id") REFERENCES "public"."organizaciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enlaces_portal" ADD CONSTRAINT "enlaces_portal_plan_id_planes_pago_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."planes_pago"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historial_plan" ADD CONSTRAINT "historial_plan_organizacion_id_organizaciones_id_fk" FOREIGN KEY ("organizacion_id") REFERENCES "public"."organizaciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historial_plan" ADD CONSTRAINT "historial_plan_plan_id_planes_pago_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."planes_pago"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_organizacion_id_organizaciones_id_fk" FOREIGN KEY ("organizacion_id") REFERENCES "public"."organizaciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_plan_id_planes_pago_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."planes_pago"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_cuota_id_cuotas_id_fk" FOREIGN KEY ("cuota_id") REFERENCES "public"."cuotas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_comprobante_archivo_id_archivos_id_fk" FOREIGN KEY ("comprobante_archivo_id") REFERENCES "public"."archivos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planes_pago" ADD CONSTRAINT "planes_pago_organizacion_id_organizaciones_id_fk" FOREIGN KEY ("organizacion_id") REFERENCES "public"."organizaciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planes_pago" ADD CONSTRAINT "planes_pago_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plantillas_mensaje" ADD CONSTRAINT "plantillas_mensaje_organizacion_id_organizaciones_id_fk" FOREIGN KEY ("organizacion_id") REFERENCES "public"."organizaciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recargos" ADD CONSTRAINT "recargos_organizacion_id_organizaciones_id_fk" FOREIGN KEY ("organizacion_id") REFERENCES "public"."organizaciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recargos" ADD CONSTRAINT "recargos_cuota_id_cuotas_id_fk" FOREIGN KEY ("cuota_id") REFERENCES "public"."cuotas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recordatorios_enviados" ADD CONSTRAINT "recordatorios_enviados_organizacion_id_organizaciones_id_fk" FOREIGN KEY ("organizacion_id") REFERENCES "public"."organizaciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recordatorios_enviados" ADD CONSTRAINT "recordatorios_enviados_cuota_id_cuotas_id_fk" FOREIGN KEY ("cuota_id") REFERENCES "public"."cuotas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clientes_org_nombre_idx" ON "clientes" USING btree ("organizacion_id","nombre");--> statement-breakpoint
CREATE INDEX "cuotas_plan_idx" ON "cuotas" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "cuotas_org_fecha_idx" ON "cuotas" USING btree ("organizacion_id","fecha_vencimiento");--> statement-breakpoint
CREATE INDEX "enlaces_plan_idx" ON "enlaces_portal" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "enlaces_ref_idx" ON "enlaces_portal" USING btree ("referencia_tipo","referencia_id");--> statement-breakpoint
CREATE INDEX "historial_plan_idx" ON "historial_plan" USING btree ("plan_id","creado_en");--> statement-breakpoint
CREATE INDEX "pagos_org_estado_idx" ON "pagos" USING btree ("organizacion_id","estado");--> statement-breakpoint
CREATE INDEX "pagos_cuota_idx" ON "pagos" USING btree ("cuota_id");--> statement-breakpoint
CREATE INDEX "planes_org_cliente_idx" ON "planes_pago" USING btree ("organizacion_id","cliente_id");--> statement-breakpoint
CREATE UNIQUE INDEX "plantillas_org_clave_uq" ON "plantillas_mensaje" USING btree ("organizacion_id","clave");--> statement-breakpoint
CREATE UNIQUE INDEX "recargos_cuota_numero_uq" ON "recargos" USING btree ("cuota_id","numero");--> statement-breakpoint
CREATE UNIQUE INDEX "recordatorios_cuota_tipo_uq" ON "recordatorios_enviados" USING btree ("cuota_id","tipo");--> statement-breakpoint
CREATE UNIQUE INDEX "tipos_cambio_fecha_moneda_uq" ON "tipos_cambio" USING btree ("fecha","moneda");