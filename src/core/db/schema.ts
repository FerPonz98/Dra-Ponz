import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const creadoEn = () => timestamp("creado_en", { withTimezone: true }).notNull().defaultNow();

// ───────────── Organizaciones (multi-cliente) ─────────────
export const organizaciones = pgTable("organizaciones", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  nombre: text("nombre").notNull(),
  logoArchivoId: uuid("logo_archivo_id"),
  qrArchivoId: uuid("qr_archivo_id"),
  colorPrimario: text("color_primario").notNull().default("#1d4ed8"),
  colorSecundario: text("color_secundario").notNull().default("#0f172a"),
  datosBancarios: text("datos_bancarios"),
  monedaDefecto: text("moneda_defecto").notNull().default("BOB"),
  zonaHoraria: text("zona_horaria").notNull().default("America/La_Paz"),
  dominio: text("dominio"),
  whatsapp: text("whatsapp"),
  suspendida: boolean("suspendida").notNull().default(false),
  creadoEn: creadoEn(),
});

export const MODULOS = ["cobros", "tesis"] as const;
export type CodigoModulo = (typeof MODULOS)[number];

export const organizacionModulos = pgTable(
  "organizacion_modulos",
  {
    organizacionId: uuid("organizacion_id").notNull().references(() => organizaciones.id, { onDelete: "cascade" }),
    modulo: text("modulo").$type<CodigoModulo>().notNull(),
    activo: boolean("activo").notNull().default(true),
    actualizadoEn: timestamp("actualizado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.organizacionId, t.modulo] })],
);

// Roles por organización con permisos "modulo:accion" (diseño tomado de PlantillaWEB).
export const roles = pgTable(
  "roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizacionId: uuid("organizacion_id").notNull().references(() => organizaciones.id, { onDelete: "cascade" }),
    nombre: text("nombre").notNull(),
    permisos: text("permisos").array().notNull().default(sql`'{}'::text[]`),
    esAdmin: boolean("es_admin").notNull().default(false),
    creadoEn: creadoEn(),
  },
  (t) => [uniqueIndex("roles_org_nombre_uq").on(t.organizacionId, t.nombre)],
);

// ───────────── Better Auth (tablas en español, claves JS que Better Auth espera) ─────────────
export const usuarios = pgTable(
  "usuarios",
  {
    id: text("id").primaryKey(),
    name: text("nombre").notNull(),
    email: text("correo").notNull().unique(),
    emailVerified: boolean("correo_verificado").notNull().default(false),
    image: text("imagen"),
    organizacionId: uuid("organizacion_id").references(() => organizaciones.id, { onDelete: "cascade" }),
    rolId: uuid("rol_id").references(() => roles.id, { onDelete: "set null" }),
    esSuperadmin: boolean("es_superadmin").notNull().default(false),
    activo: boolean("activo").notNull().default(true),
    createdAt: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("actualizado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("usuarios_org_idx").on(t.organizacionId)],
);

export const sesiones = pgTable("sesiones", {
  id: text("id").primaryKey(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expira_en", { withTimezone: true }).notNull(),
  ipAddress: text("ip"),
  userAgent: text("agente_usuario"),
  userId: text("usuario_id").notNull().references(() => usuarios.id, { onDelete: "cascade" }),
  createdAt: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("actualizado_en", { withTimezone: true }).notNull().defaultNow(),
});

export const cuentas = pgTable("cuentas", {
  id: text("id").primaryKey(),
  accountId: text("cuenta_id").notNull(),
  providerId: text("proveedor_id").notNull(),
  userId: text("usuario_id").notNull().references(() => usuarios.id, { onDelete: "cascade" }),
  accessToken: text("token_acceso"),
  refreshToken: text("token_refresco"),
  idToken: text("token_id"),
  accessTokenExpiresAt: timestamp("token_acceso_expira_en", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("token_refresco_expira_en", { withTimezone: true }),
  scope: text("alcance"),
  password: text("contrasena"),
  createdAt: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("actualizado_en", { withTimezone: true }).notNull().defaultNow(),
});

export const verificaciones = pgTable("verificaciones", {
  id: text("id").primaryKey(),
  identifier: text("identificador").notNull(),
  value: text("valor").notNull(),
  expiresAt: timestamp("expira_en", { withTimezone: true }).notNull(),
  createdAt: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("actualizado_en", { withTimezone: true }).notNull().defaultNow(),
});

// ───────────── Archivos (disco en UPLOAD_DIR, servidos solo por rutas autenticadas) ─────────────
export const archivos = pgTable(
  "archivos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizacionId: uuid("organizacion_id").notNull().references(() => organizaciones.id, { onDelete: "cascade" }),
    rutaRelativa: text("ruta_relativa").notNull(),
    nombreOriginal: text("nombre_original").notNull(),
    tipoMime: text("tipo_mime").notNull(),
    tamanoBytes: bigint("tamano_bytes", { mode: "number" }).notNull(),
    categoria: text("categoria").notNull(),
    // Dueño lógico (p. ej. enlace de portal) para autorizar descargas desde el portal.
    enlaceId: uuid("enlace_id"),
    subidoPor: text("subido_por"),
    creadoEn: creadoEn(),
  },
  (t) => [index("archivos_org_idx").on(t.organizacionId), index("archivos_enlace_idx").on(t.enlaceId)],
);

// ───────────── Auditoría y alertas ─────────────
export const auditoria = pgTable(
  "auditoria",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizacionId: uuid("organizacion_id").notNull().references(() => organizaciones.id, { onDelete: "cascade" }),
    usuarioId: text("usuario_id"),
    modulo: text("modulo").notNull(),
    accion: text("accion").notNull(),
    entidad: text("entidad"),
    entidadId: text("entidad_id"),
    detalle: jsonb("detalle"),
    creadoEn: creadoEn(),
  },
  (t) => [index("auditoria_org_fecha_idx").on(t.organizacionId, t.creadoEn)],
);

// Alertas globales del sistema (p. ej. falla del tipo de cambio). No pertenecen a una organización.
export const alertasSistema = pgTable("alertas_sistema", {
  id: uuid("id").primaryKey().defaultRandom(),
  tipo: text("tipo").notNull(),
  mensaje: text("mensaje").notNull(),
  resuelta: boolean("resuelta").notNull().default(false),
  creadoEn: creadoEn(),
});
