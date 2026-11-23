import { sql } from "drizzle-orm";
import { boolean, date, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { archivos, organizaciones } from "@/core/db/schema";
import { clientes, cuotas, planesPago } from "@/modules/cobros/schema";

const org = () =>
  uuid("organizacion_id")
    .notNull()
    .references(() => organizaciones.id, { onDelete: "cascade" });
const creadoEn = () => timestamp("creado_en", { withTimezone: true }).notNull().defaultNow();

export const ESTADOS_PROYECTO = ["borrador", "enviada", "vencida", "aceptada", "en_curso", "en_gracia", "en_cola", "tribunal", "finalizado"] as const;
export type EstadoProyecto = (typeof ESTADOS_PROYECTO)[number];
export type Nivel = "pregrado" | "posgrado";

export const formularios = pgTable("formularios", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizacionId: org(),
  nombre: text("nombre").notNull(),
  descripcion: text("descripcion"),
  activo: boolean("activo").notNull().default(true),
  creadoEn: creadoEn(),
});

export { TIPOS_CAMPO, type TipoCampo } from "@/modules/tesis/dominio/campos";
import type { TipoCampo } from "@/modules/tesis/dominio/campos";

export const formularioCampos = pgTable(
  "formulario_campos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizacionId: org(),
    formularioId: uuid("formulario_id")
      .notNull()
      .references(() => formularios.id, { onDelete: "cascade" }),
    orden: integer("orden").notNull(),
    tipo: text("tipo").$type<TipoCampo>().notNull(),
    etiqueta: text("etiqueta").notNull(),
    ayuda: text("ayuda"),
    obligatorio: boolean("obligatorio").notNull().default(false),
    opciones: text("opciones").array().notNull().default(sql`'{}'::text[]`),
  },
  (t) => [index("campos_formulario_idx").on(t.formularioId, t.orden)],
);

export const propuestas = pgTable(
  "propuestas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizacionId: org(),
    clienteId: uuid("cliente_id")
      .notNull()
      .references(() => clientes.id, { onDelete: "restrict" }),
    planId: uuid("plan_id")
      .notNull()
      .references(() => planesPago.id, { onDelete: "restrict" }),
    titulo: text("titulo").notNull(),
    universidad: text("universidad"),
    nivel: text("nivel").$type<Nivel>().notNull().default("pregrado"),
    estado: text("estado").$type<EstadoProyecto>().notNull().default("borrador"),
    precioTerceraRevisionCentavos: integer("precio_tercera_revision_centavos").notNull().default(0),
    formularioId: uuid("formulario_id").references(() => formularios.id, { onDelete: "set null" }),
    vigenciaDias: integer("vigencia_dias").notNull().default(7),
    enviadaEn: timestamp("enviada_en", { withTimezone: true }),
    expiraEn: timestamp("expira_en", { withTimezone: true }),
    aceptadaEn: timestamp("aceptada_en", { withTimezone: true }),
    requiereNuevoCronograma: boolean("requiere_nuevo_cronograma").notNull().default(false),
    vecesEnviada: integer("veces_enviada").notNull().default(0),
    notas: text("notas"),
    creadoEn: creadoEn(),
    actualizadoEn: timestamp("actualizado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("propuestas_org_estado_idx").on(t.organizacionId, t.estado), uniqueIndex("propuestas_plan_uq").on(t.planId)],
);

export const cronogramas = pgTable(
  "cronogramas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizacionId: org(),
    propuestaId: uuid("propuesta_id")
      .notNull()
      .references(() => propuestas.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    fechaInicio: date("fecha_inicio").notNull(),
    meses: integer("meses").notNull(),
    estado: text("estado").$type<"propuesto" | "aceptado" | "reemplazado">().notNull().default("propuesto"),
    aceptadoEn: timestamp("aceptado_en", { withTimezone: true }),
    creadoEn: creadoEn(),
  },
  (t) => [uniqueIndex("cronogramas_propuesta_version_uq").on(t.propuestaId, t.version)],
);

export const actividades = pgTable(
  "actividades",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizacionId: org(),
    cronogramaId: uuid("cronograma_id")
      .notNull()
      .references(() => cronogramas.id, { onDelete: "cascade" }),
    orden: integer("orden").notNull(),
    nombre: text("nombre").notNull(),
    meses: integer("meses").array().notNull(),
    aCargoEstudiante: boolean("a_cargo_estudiante").notNull().default(false),
    hecha: boolean("hecha").notNull().default(false),
    hechaEn: timestamp("hecha_en", { withTimezone: true }),
  },
  (t) => [index("actividades_cronograma_idx").on(t.cronogramaId, t.orden)],
);

export const revisiones = pgTable(
  "revisiones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizacionId: org(),
    propuestaId: uuid("propuesta_id")
      .notNull()
      .references(() => propuestas.id, { onDelete: "cascade" }),
    numero: integer("numero").notNull(),
    incluida: boolean("incluida").notNull(),
    precioCentavos: integer("precio_centavos").notNull().default(0),
    estado: text("estado").$type<"pendiente" | "solicitada" | "aprobada" | "hecha">().notNull().default("pendiente"),
    cuotaId: uuid("cuota_id").references(() => cuotas.id, { onDelete: "set null" }),
    solicitadaEn: timestamp("solicitada_en", { withTimezone: true }),
    hechaEn: timestamp("hecha_en", { withTimezone: true }),
  },
  (t) => [uniqueIndex("revisiones_propuesta_numero_uq").on(t.propuestaId, t.numero)],
);

export const extrasCatalogo = pgTable("extras_catalogo", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizacionId: org(),
  nombre: text("nombre").notNull(),
  precioCentavos: integer("precio_centavos").notNull(),
  activo: boolean("activo").notNull().default(true),
  creadoEn: creadoEn(),
});

export const propuestaExtras = pgTable("propuesta_extras", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizacionId: org(),
  propuestaId: uuid("propuesta_id")
    .notNull()
    .references(() => propuestas.id, { onDelete: "cascade" }),
  nombre: text("nombre").notNull(),
  precioCentavos: integer("precio_centavos").notNull(),
  estado: text("estado").$type<"ofrecido" | "solicitado" | "aprobado" | "entregado">().notNull().default("ofrecido"),
  cuotaId: uuid("cuota_id").references(() => cuotas.id, { onDelete: "set null" }),
  solicitadoEn: timestamp("solicitado_en", { withTimezone: true }),
});

export const respuestasFormulario = pgTable(
  "respuestas_formulario",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizacionId: org(),
    propuestaId: uuid("propuesta_id")
      .notNull()
      .references(() => propuestas.id, { onDelete: "cascade" }),
    formularioId: uuid("formulario_id")
      .notNull()
      .references(() => formularios.id, { onDelete: "cascade" }),
    // { campoId: texto | { archivoId, nombre } }
    valores: jsonb("valores").$type<Record<string, unknown>>().notNull(),
    enviadoEn: timestamp("enviado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("respuestas_propuesta_formulario_uq").on(t.propuestaId, t.formularioId)],
);

export const archivosProyecto = pgTable(
  "archivos_proyecto",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizacionId: org(),
    propuestaId: uuid("propuesta_id")
      .notNull()
      .references(() => propuestas.id, { onDelete: "cascade" }),
    archivoId: uuid("archivo_id")
      .notNull()
      .references(() => archivos.id, { onDelete: "cascade" }),
    origen: text("origen").$type<"estudiante" | "asesora" | "formulario">().notNull(),
    descripcion: text("descripcion"),
    creadoEn: creadoEn(),
  },
  (t) => [index("archivos_proyecto_idx").on(t.propuestaId)],
);

export const historialPropuesta = pgTable(
  "historial_propuesta",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizacionId: org(),
    propuestaId: uuid("propuesta_id")
      .notNull()
      .references(() => propuestas.id, { onDelete: "cascade" }),
    evento: text("evento").notNull(),
    detalle: text("detalle"),
    usuarioNombre: text("usuario_nombre"),
    creadoEn: creadoEn(),
  },
  (t) => [index("historial_propuesta_idx").on(t.propuestaId, t.creadoEn)],
);
