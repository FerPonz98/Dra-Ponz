CREATE TABLE "intentos_login" (
	"correo" text PRIMARY KEY NOT NULL,
	"fallidos" integer DEFAULT 0 NOT NULL,
	"bloqueado_hasta" timestamp with time zone,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "limites_auth" (
	"id" text PRIMARY KEY NOT NULL,
	"clave" text NOT NULL,
	"conteo" integer NOT NULL,
	"ultima_peticion" bigint NOT NULL,
	CONSTRAINT "limites_auth_clave_unique" UNIQUE("clave")
);
