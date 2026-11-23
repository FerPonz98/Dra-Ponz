import { boolean, date, index, integer, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { archivos, organizaciones } from "@/core/db/schema";

const org = () =>
  uuid("organizacion_id")
    .notNull()
    .references(() => organizaciones.id, { onDelete: "cascade" });
const creadoEn = () => timestamp("creado_en", { withTimezone: true }).notNull().defaultNow();

export const MONEDAS = ["BOB", "BRL"] as const;
export type Moneda = (typeof MONEDAS)[number];
export const ESTADOS_MORA = ["al_dia", "vencida", "en_cola"] as const;
export type EstadoMora = (typeof ESTADOS_MORA)[number];
export type ModoRecargo = "unico" | "mensual";

export const clientes = pgTable(
  "clientes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizacionId: org(),
    nombre: text("nombre").notNull(),
    ci: text("ci"),
    whatsapp: text("whatsapp"),
    correo: text("correo"),
    notas: text("notas"),
    creadoEn: creadoEn(),
  },
  (t) => [index("clientes_org_nombre_idx").on(t.organizacionId, t.nombre)],
);

export const planesPago = pgTable(
  "planes_pago",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizacionId: org(),
    clienteId: uuid("cliente_id")
      .notNull()
      .references(() => clientes.id, { onDelete: "restrict" }),
    titulo: text("titulo").notNull(),
    moneda: text("moneda").$type<Moneda>().notNull().default("BOB"),
    estado: text("estado").$type<"activo" | "finalizado" | "anulado">().notNull().default("activo"),
    estadoMora: text("estado_mora").$type<EstadoMora>().notNull().default("al_dia"),
    aceptadoEn: timestamp("aceptado_en", { withTimezone: true }),
    // Reglas de mora (todas opcionales)
    plazoPrimeraCuotaDias: integer("plazo_primera_cuota_dias"),
    diasGracia: integer("dias_gracia"),
    recargoActivo: boolean("recargo_activo").notNull().default(false),
    recargoPorcentaje: numeric("recargo_porcentaje", { precision: 6, scale: 2 }),
    recargoModo: text("recargo_modo").$type<ModoRecargo>().notNull().default("unico"),
    diasGraciaNuevaMora: integer("dias_gracia_nueva_mora"),
    numeroMoras: integer("numero_moras").notNull().default(0),
    origen: text("origen"),
    creadoEn: creadoEn(),
    actualizadoEn: timestamp("actualizado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("planes_org_cliente_idx").on(t.organizacionId, t.clienteId)],
);

export const cuotas = pgTable(
  "cuotas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizacionId: org(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => planesPago.id, { onDelete: "cascade" }),
    numero: integer("numero").notNull(),
    concepto: text("concepto"),
    montoCentavos: integer("monto_centavos").notNull(),
    fechaVencimiento: date("fecha_vencimiento").notNull(),
    estado: text("estado").$type<"pendiente" | "pagada">().notNull().default("pendiente"),
    pagadaEn: timestamp("pagada_en", { withTimezone: true }),
    creadoEn: creadoEn(),
  },
  (t) => [index("cuotas_plan_idx").on(t.planId), index("cuotas_org_fecha_idx").on(t.organizacionId, t.fechaVencimiento)],
);

export const recargos = pgTable(
  "recargos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizacionId: org(),
    cuotaId: uuid("cuota_id")
      .notNull()
      .references(() => cuotas.id, { onDelete: "cascade" }),
    numero: integer("numero").notNull(),
    porcentaje: numeric("porcentaje", { precision: 6, scale: 2 }).notNull(),
    montoCentavos: integer("monto_centavos").notNull(),
    aplicadoEn: date("aplicado_en").notNull(),
    creadoEn: creadoEn(),
  },
  // Idempotencia del job: un recargo por (cuota, número de mes).
  (t) => [uniqueIndex("recargos_cuota_numero_uq").on(t.cuotaId, t.numero)],
);

export const historialPlan = pgTable(
  "historial_plan",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizacionId: org(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => planesPago.id, { onDelete: "cascade" }),
    cuotaId: uuid("cuota_id"),
    usuarioId: text("usuario_id"),
    usuarioNombre: text("usuario_nombre"),
    campo: text("campo").notNull(),
    valorAntes: text("valor_antes"),
    valorDespues: text("valor_despues"),
    creadoEn: creadoEn(),
  },
  (t) => [index("historial_plan_idx").on(t.planId, t.creadoEn)],
);

export const enlacesPortal = pgTable(
  "enlaces_portal",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizacionId: org(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => planesPago.id, { onDelete: "cascade" }),
    // null = enlace destruido (anulado o vencido)
    token: text("token").unique(),
    metodo: text("metodo").$type<"ci" | "pin">().notNull(),
    ci: text("ci"),
    pinHash: text("pin_hash"),
    intentosFallidos: integer("intentos_fallidos").notNull().default(0),
    bloqueadoHasta: timestamp("bloqueado_hasta", { withTimezone: true }),
    expiraEn: timestamp("expira_en", { withTimezone: true }),
    anuladoEn: timestamp("anulado_en", { withTimezone: true }),
    // Referencia genérica para módulos que extienden el portal (cobros no conoce a quién apunta).
    referenciaTipo: text("referencia_tipo"),
    referenciaId: uuid("referencia_id"),
    ultimoAccesoEn: timestamp("ultimo_acceso_en", { withTimezone: true }),
    creadoEn: creadoEn(),
  },
  (t) => [index("enlaces_plan_idx").on(t.planId), index("enlaces_ref_idx").on(t.referenciaTipo, t.referenciaId)],
);

export const pagos = pgTable(
  "pagos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizacionId: org(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => planesPago.id, { onDelete: "cascade" }),
    cuotaId: uuid("cuota_id")
      .notNull()
      .references(() => cuotas.id, { onDelete: "cascade" }),
    enlaceId: uuid("enlace_id"),
    moneda: text("moneda").$type<Moneda>().notNull(),
    montoCentavos: integer("monto_centavos").notNull(),
    tipoCambio: numeric("tipo_cambio", { precision: 12, scale: 5 }),
    tipoCambioFecha: date("tipo_cambio_fecha"),
    montoBobCentavos: integer("monto_bob_centavos").notNull(),
    comprobanteArchivoId: uuid("comprobante_archivo_id").references(() => archivos.id, { onDelete: "set null" }),
    estado: text("estado").$type<"pendiente" | "aprobado" | "rechazado">().notNull().default("pendiente"),
    motivoRechazo: text("motivo_rechazo"),
    revisadoPor: text("revisado_por"),
    revisadoEn: timestamp("revisado_en", { withTimezone: true }),
    creadoEn: creadoEn(),
  },
  (t) => [index("pagos_org_estado_idx").on(t.organizacionId, t.estado), index("pagos_cuota_idx").on(t.cuotaId)],
);

// Cotizaciones oficiales (globales, no pertenecen a una organización).
export const tiposCambio = pgTable(
  "tipos_cambio",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fecha: date("fecha").notNull(),
    moneda: text("moneda").notNull(),
    valor: numeric("valor", { precision: 12, scale: 5 }).notNull(),
    fuente: text("fuente").notNull().default("BCB"),
    creadoEn: creadoEn(),
  },
  (t) => [uniqueIndex("tipos_cambio_fecha_moneda_uq").on(t.fecha, t.moneda)],
);

export const plantillasMensaje = pgTable(
  "plantillas_mensaje",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizacionId: org(),
    clave: text("clave").notNull(),
    titulo: text("titulo").notNull(),
    cuerpo: text("cuerpo").notNull(),
    actualizadoEn: timestamp("actualizado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("plantillas_org_clave_uq").on(t.organizacionId, t.clave)],
);

export const recordatoriosEnviados = pgTable(
  "recordatorios_enviados",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizacionId: org(),
    cuotaId: uuid("cuota_id")
      .notNull()
      .references(() => cuotas.id, { onDelete: "cascade" }),
    tipo: text("tipo").$type<"faltan_3_dias" | "vence_hoy">().notNull(),
    canal: text("canal").notNull().default("correo"),
    fecha: date("fecha").notNull(),
    creadoEn: creadoEn(),
  },
  (t) => [uniqueIndex("recordatorios_cuota_tipo_uq").on(t.cuotaId, t.tipo)],
);
