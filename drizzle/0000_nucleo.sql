CREATE TABLE "alertas_sistema" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tipo" text NOT NULL,
	"mensaje" text NOT NULL,
	"resuelta" boolean DEFAULT false NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "archivos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacion_id" uuid NOT NULL,
	"ruta_relativa" text NOT NULL,
	"nombre_original" text NOT NULL,
	"tipo_mime" text NOT NULL,
	"tamano_bytes" bigint NOT NULL,
	"categoria" text NOT NULL,
	"enlace_id" uuid,
	"subido_por" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auditoria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacion_id" uuid NOT NULL,
	"usuario_id" text,
	"modulo" text NOT NULL,
	"accion" text NOT NULL,
	"entidad" text,
	"entidad_id" text,
	"detalle" jsonb,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cuentas" (
	"id" text PRIMARY KEY NOT NULL,
	"cuenta_id" text NOT NULL,
	"proveedor_id" text NOT NULL,
	"usuario_id" text NOT NULL,
	"token_acceso" text,
	"token_refresco" text,
	"token_id" text,
	"token_acceso_expira_en" timestamp with time zone,
	"token_refresco_expira_en" timestamp with time zone,
	"alcance" text,
	"contrasena" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizacion_modulos" (
	"organizacion_id" uuid NOT NULL,
	"modulo" text NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizacion_modulos_organizacion_id_modulo_pk" PRIMARY KEY("organizacion_id","modulo")
);
--> statement-breakpoint
CREATE TABLE "organizaciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"nombre" text NOT NULL,
	"logo_archivo_id" uuid,
	"qr_archivo_id" uuid,
	"color_primario" text DEFAULT '#1d4ed8' NOT NULL,
	"color_secundario" text DEFAULT '#0f172a' NOT NULL,
	"datos_bancarios" text,
	"moneda_defecto" text DEFAULT 'BOB' NOT NULL,
	"zona_horaria" text DEFAULT 'America/La_Paz' NOT NULL,
	"dominio" text,
	"whatsapp" text,
	"suspendida" boolean DEFAULT false NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizaciones_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacion_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"permisos" text[] DEFAULT '{}'::text[] NOT NULL,
	"es_admin" boolean DEFAULT false NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sesiones" (
	"id" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"expira_en" timestamp with time zone NOT NULL,
	"ip" text,
	"agente_usuario" text,
	"usuario_id" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sesiones_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" text PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"correo" text NOT NULL,
	"correo_verificado" boolean DEFAULT false NOT NULL,
	"imagen" text,
	"organizacion_id" uuid,
	"rol_id" uuid,
	"es_superadmin" boolean DEFAULT false NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuarios_correo_unique" UNIQUE("correo")
);
--> statement-breakpoint
CREATE TABLE "verificaciones" (
	"id" text PRIMARY KEY NOT NULL,
	"identificador" text NOT NULL,
	"valor" text NOT NULL,
	"expira_en" timestamp with time zone NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "archivos" ADD CONSTRAINT "archivos_organizacion_id_organizaciones_id_fk" FOREIGN KEY ("organizacion_id") REFERENCES "public"."organizaciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_organizacion_id_organizaciones_id_fk" FOREIGN KEY ("organizacion_id") REFERENCES "public"."organizaciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cuentas" ADD CONSTRAINT "cuentas_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizacion_modulos" ADD CONSTRAINT "organizacion_modulos_organizacion_id_organizaciones_id_fk" FOREIGN KEY ("organizacion_id") REFERENCES "public"."organizaciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_organizacion_id_organizaciones_id_fk" FOREIGN KEY ("organizacion_id") REFERENCES "public"."organizaciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sesiones" ADD CONSTRAINT "sesiones_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_organizacion_id_organizaciones_id_fk" FOREIGN KEY ("organizacion_id") REFERENCES "public"."organizaciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_rol_id_roles_id_fk" FOREIGN KEY ("rol_id") REFERENCES "public"."roles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "archivos_org_idx" ON "archivos" USING btree ("organizacion_id");--> statement-breakpoint
CREATE INDEX "archivos_enlace_idx" ON "archivos" USING btree ("enlace_id");--> statement-breakpoint
CREATE INDEX "auditoria_org_fecha_idx" ON "auditoria" USING btree ("organizacion_id","creado_en");--> statement-breakpoint
CREATE UNIQUE INDEX "roles_org_nombre_uq" ON "roles" USING btree ("organizacion_id","nombre");--> statement-breakpoint
CREATE INDEX "usuarios_org_idx" ON "usuarios" USING btree ("organizacion_id");