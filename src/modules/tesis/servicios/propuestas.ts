import { and, asc, desc, eq, inArray, isNull, lte, sql } from "drizzle-orm";
import { z } from "zod";
import type { Ejecutor } from "@/lib/db";
import { formatoFecha, sumarDias } from "@/lib/fechas";
import { esquemaCuota, esquemaReglasMora, type CuotaEditable } from "@/modules/cobros/dominio/plan";
import { clientes, cuotas, enlacesPortal, MONEDAS } from "@/modules/cobros/schema";
import { crearCliente } from "@/modules/cobros/servicios/clientes";
import { anularEnlacesDePlan, crearEnlace, urlPortal } from "@/modules/cobros/servicios/enlaces";
import { cambiarMonedaYTitulo, crearPlan, eliminarPlan, guardarCuotas, guardarReglas, marcarAceptado, obtenerPlanCompleto, type Actor } from "@/modules/cobros/servicios/planes";
import { esquemaCronograma, type DatosCronograma } from "@/modules/tesis/dominio/cronograma";
import { calcularExpiracion, debeVencer, ESTADOS_EDITABLES, siguienteEstado } from "@/modules/tesis/dominio/estados";
import {
  actividades,
  archivosProyecto,
  cronogramas,
  historialPropuesta,
  propuestaExtras,
  propuestas,
  respuestasFormulario,
  revisiones,
  type EstadoProyecto,
} from "@/modules/tesis/schema";
import { quitarFilasArchivos } from "@/core/archivos";
import { archivos } from "@/core/db/schema";

export const REFERENCIA_PROPUESTA = "propuesta";

const esquemaEstudiante = z.union([
  z.object({ clienteId: z.uuid("Elige un estudiante") }),
  z.object({
    nuevo: z.object({
      nombre: z.string().trim().min(2, "Escribe el nombre del estudiante").max(150),
      ci: z.string().trim().max(30).default(""),
      whatsapp: z.string().trim().max(20).default(""),
      correo: z.union([z.literal(""), z.email("Correo inválido")]).default(""),
    }),
  }),
]);

export const esquemaPropuesta = z.object({
  estudiante: esquemaEstudiante,
  titulo: z.string().trim().min(3, "Escribe el tema o nombre del proyecto").max(300),
  universidad: z.string().trim().max(200).default(""),
  nivel: z.enum(["pregrado", "posgrado"]),
  moneda: z.enum(MONEDAS),
  cuotas: z.array(esquemaCuota).min(1, "Agrega al menos una cuota").max(60),
  cronograma: esquemaCronograma,
  reglas: esquemaReglasMora,
  precioTerceraRevisionCentavos: z.number().int().min(0).max(100_000_000),
  extras: z.array(z.object({ nombre: z.string().trim().min(2).max(120), precioCentavos: z.number().int().min(0).max(100_000_000) })).max(20),
  formularioId: z.uuid().nullable(),
  vigenciaDias: z.number().int().min(1, "Vigencia mínima 1 día").max(90, "Vigencia máxima 90 días"),
});
export type DatosPropuesta = z.input<typeof esquemaPropuesta>;

async function anotar(tx: Ejecutor, organizacionId: string, propuestaId: string, evento: string, detalle?: string | null, usuario?: string | null) {
  await tx.insert(historialPropuesta).values({ organizacionId, propuestaId, evento, detalle: detalle ?? null, usuarioNombre: usuario ?? null });
}

async function insertarCronograma(tx: Ejecutor, organizacionId: string, propuestaId: string, c: DatosCronograma, version: number, estado: "propuesto" | "aceptado" = "propuesto") {
  const [cr] = await tx.insert(cronogramas).values({ organizacionId, propuestaId, version, fechaInicio: c.fechaInicio, meses: c.meses, estado }).returning();
  await tx.insert(actividades).values(
    c.actividades.map((a, i) => ({
      organizacionId,
      cronogramaId: cr.id,
      orden: i + 1,
      nombre: a.nombre,
      meses: [...new Set(a.meses)].sort((x, y) => x - y),
      aCargoEstudiante: a.aCargoEstudiante,
      hecha: a.hecha ?? false,
      hechaEn: a.hecha ? new Date() : null,
    })),
  );
  return cr;
}

/** Crea o edita (borrador/enviada/vencida) una propuesta y su plan de pagos en Cobros. */
export async function guardarPropuesta(tx: Ejecutor, actor: Actor, entrada: DatosPropuesta, id?: string) {
  const d = esquemaPropuesta.parse(entrada);
  const org = actor.organizacionId;
  let clienteId: string;
  if ("clienteId" in d.estudiante) clienteId = d.estudiante.clienteId;
  else clienteId = (await crearCliente(tx, org, d.estudiante.nuevo)).id;

  if (!id) {
    const plan = await crearPlan(tx, actor, { clienteId, titulo: d.titulo, moneda: d.moneda, cuotas: d.cuotas, reglas: d.reglas, origen: "tesis", aceptado: false });
    const [p] = await tx
      .insert(propuestas)
      .values({
        organizacionId: org,
        clienteId,
        planId: plan.id,
        titulo: d.titulo,
        universidad: d.universidad || null,
        nivel: d.nivel,
        precioTerceraRevisionCentavos: d.precioTerceraRevisionCentavos,
        formularioId: d.formularioId,
        vigenciaDias: d.vigenciaDias,
      })
      .returning();
    await insertarCronograma(tx, org, p.id, d.cronograma, 1);
    await tx.insert(revisiones).values([
      { organizacionId: org, propuestaId: p.id, numero: 1, incluida: true },
      { organizacionId: org, propuestaId: p.id, numero: 2, incluida: true },
    ]);
    if (d.extras.length) await tx.insert(propuestaExtras).values(d.extras.map((e) => ({ organizacionId: org, propuestaId: p.id, nombre: e.nombre, precioCentavos: e.precioCentavos })));
    await anotar(tx, org, p.id, "Propuesta creada", null, actor.usuarioNombre);
    return p;
  }

  const [p] = await tx.select().from(propuestas).where(eq(propuestas.id, id)).for("update");
  if (!p) throw new Error("Propuesta no encontrada");
  if (!ESTADOS_EDITABLES.includes(p.estado) || p.aceptadaEn) throw new Error("Solo se puede editar una propuesta en borrador, enviada o vencida (sin aceptar).");
  await cambiarMonedaYTitulo(tx, actor, p.planId, { titulo: d.titulo, moneda: d.moneda, clienteId });
  await guardarCuotas(tx, actor, p.planId, d.cuotas as CuotaEditable[]);
  await guardarReglas(tx, actor, p.planId, d.reglas);
  await tx
    .update(propuestas)
    .set({
      clienteId,
      titulo: d.titulo,
      universidad: d.universidad || null,
      nivel: d.nivel,
      precioTerceraRevisionCentavos: d.precioTerceraRevisionCentavos,
      formularioId: d.formularioId,
      vigenciaDias: d.vigenciaDias,
      actualizadoEn: new Date(),
    })
    .where(eq(propuestas.id, id));
  const [{ max }] = await tx.select({ max: sql<number>`coalesce(max(${cronogramas.version}),0)::int` }).from(cronogramas).where(eq(cronogramas.propuestaId, id));
  await tx.delete(cronogramas).where(eq(cronogramas.propuestaId, id));
  await insertarCronograma(tx, org, id, d.cronograma, max + 1);
  await tx.delete(propuestaExtras).where(and(eq(propuestaExtras.propuestaId, id), eq(propuestaExtras.estado, "ofrecido")));
  if (d.extras.length) await tx.insert(propuestaExtras).values(d.extras.map((e) => ({ organizacionId: org, propuestaId: id, nombre: e.nombre, precioCentavos: e.precioCentavos })));
  await anotar(tx, org, id, "Propuesta editada", `Estado: ${p.estado}`, actor.usuarioNombre);
  return { ...p, titulo: d.titulo };
}

/** Envía (o reenvía) la propuesta: nuevo enlace con vigencia; el anterior queda destruido. */
export async function enviarPropuesta(tx: Ejecutor, actor: Actor, id: string, metodo: "ci" | "pin", ahora = new Date()) {
  const [p] = await tx.select().from(propuestas).where(eq(propuestas.id, id)).for("update");
  if (!p) throw new Error("Propuesta no encontrada");
  if (p.aceptadaEn || !ESTADOS_EDITABLES.includes(p.estado)) throw new Error("Esta propuesta ya fue aceptada.");
  const expiraEn = calcularExpiracion(ahora, p.vigenciaDias);
  const e = await crearEnlace(tx, { organizacionId: actor.organizacionId, planId: p.planId, metodo, expiraEn, referenciaTipo: REFERENCIA_PROPUESTA, referenciaId: p.id });
  await tx.update(propuestas).set({ estado: "enviada", enviadaEn: ahora, expiraEn, vecesEnviada: p.vecesEnviada + 1, actualizadoEn: ahora }).where(eq(propuestas.id, id));
  await anotar(tx, actor.organizacionId, id, p.vecesEnviada ? "Propuesta reenviada con enlace nuevo" : "Propuesta enviada", `Vence ${formatoFecha(expiraEn)}`, actor.usuarioNombre);
  return { url: urlPortal(e.token), pin: e.pin, expiraEn };
}

/** Vence las propuestas no aceptadas: el enlace se destruye y la propuesta queda guardada como `vencida`. */
export async function vencerPropuestas(tx: Ejecutor, ahora = new Date()) {
  const candidatas = await tx
    .select()
    .from(propuestas)
    .where(and(eq(propuestas.estado, "enviada"), isNull(propuestas.aceptadaEn), lte(propuestas.expiraEn, ahora)));
  for (const p of candidatas) {
    if (!debeVencer(p, ahora)) continue;
    await tx.update(propuestas).set({ estado: "vencida", actualizadoEn: ahora }).where(eq(propuestas.id, p.id));
    await anularEnlacesDePlan(tx, p.planId);
    await anotar(tx, p.organizacionId, p.id, "Propuesta vencida", "El enlace se destruyó por fin de vigencia");
  }
  return candidatas.length;
}

/** El estudiante acepta en su enlace (se guarda fecha y hora). El enlace deja de vencer. */
export async function aceptarPropuesta(tx: Ejecutor, propuestaId: string, ahora = new Date()) {
  const [p] = await tx.select().from(propuestas).where(eq(propuestas.id, propuestaId)).for("update");
  if (!p) throw new Error("Propuesta no encontrada");
  if (p.aceptadaEn) return p;
  if (p.estado !== "enviada" || debeVencer(p, ahora)) throw new Error("La propuesta ya no está vigente.");
  await tx.update(propuestas).set({ aceptadaEn: ahora, actualizadoEn: ahora }).where(eq(propuestas.id, propuestaId));
  await marcarAceptado(tx, { organizacionId: p.organizacionId, usuarioId: null, usuarioNombre: "estudiante" }, p.planId, ahora);
  await tx.update(cronogramas).set({ estado: "aceptado", aceptadoEn: ahora }).where(and(eq(cronogramas.propuestaId, propuestaId), eq(cronogramas.estado, "propuesto")));
  await tx.update(enlacesPortal).set({ expiraEn: null }).where(and(eq(enlacesPortal.planId, p.planId), sql`${enlacesPortal.token} is not null`));
  await anotar(tx, p.organizacionId, propuestaId, "Propuesta aceptada por el estudiante", formatoFecha(ahora), "estudiante");
  return { ...p, aceptadaEn: ahora };
}

/** Recalcula el estado del proyecto a partir de Cobros (mora del plan) y del cronograma. */
export async function sincronizarProyecto(tx: Ejecutor, propuestaId: string, hoy: string, ahora = new Date()) {
  const [p] = await tx.select().from(propuestas).where(eq(propuestas.id, propuestaId));
  if (!p) return null;
  const plan = await obtenerPlanCompleto(tx, p.planId);
  if (!plan) return null;
  const [acept] = await tx
    .select()
    .from(cronogramas)
    .where(and(eq(cronogramas.propuestaId, propuestaId), eq(cronogramas.estado, "aceptado")))
    .orderBy(desc(cronogramas.version))
    .limit(1);
  const r = siguienteEstado({
    estado: p.estado,
    aceptadaEn: p.aceptadaEn,
    expiraEn: p.expiraEn,
    primeraCuotaPagada: plan.cuotas[0]?.estado === "pagada",
    estadoMora: plan.plan.estadoMora,
    requiereNuevoCronograma: p.requiereNuevoCronograma,
    cronogramaAceptadoInicio: acept?.fechaInicio ?? null,
    hoy,
    ahora,
  });
  if (r.estado !== p.estado || r.requiereNuevoCronograma !== p.requiereNuevoCronograma) {
    await tx.update(propuestas).set({ estado: r.estado, requiereNuevoCronograma: r.requiereNuevoCronograma, actualizadoEn: ahora }).where(eq(propuestas.id, propuestaId));
    if (r.estado === "vencida") await anularEnlacesDePlan(tx, p.planId);
    if (r.estado !== p.estado) await anotar(tx, p.organizacionId, propuestaId, `Estado: ${p.estado} → ${r.estado}`);
  }
  return r;
}

export async function sincronizarPorPlan(tx: Ejecutor, planId: string, hoy: string, ahora = new Date()) {
  const [p] = await tx.select({ id: propuestas.id }).from(propuestas).where(eq(propuestas.planId, planId));
  return p ? sincronizarProyecto(tx, p.id, hoy, ahora) : null;
}

export async function sincronizarTodos(tx: Ejecutor, hoy: string, ahora = new Date()) {
  const vencidas = await vencerPropuestas(tx, ahora);
  const activos = await tx.select({ id: propuestas.id }).from(propuestas).where(inArray(propuestas.estado, ["enviada", "aceptada", "en_curso", "en_gracia", "en_cola"]));
  let cambios = 0;
  for (const a of activos) {
    const antes = await tx.select({ e: propuestas.estado }).from(propuestas).where(eq(propuestas.id, a.id));
    const r = await sincronizarProyecto(tx, a.id, hoy, ahora);
    if (r && r.estado !== antes[0]?.e) cambios++;
  }
  return { vencidas, revisados: activos.length, cambios };
}

/** Al salir de la cola: la asesora arma un cronograma nuevo (fechas corridas) que el estudiante debe aceptar. */
export async function proponerNuevoCronograma(tx: Ejecutor, actor: Actor, propuestaId: string, c: DatosCronograma) {
  const datos = esquemaCronograma.parse(c);
  const [p] = await tx.select().from(propuestas).where(eq(propuestas.id, propuestaId));
  if (!p) throw new Error("Propuesta no encontrada");
  if (!p.aceptadaEn) throw new Error("La propuesta aún no fue aceptada; edítala directamente.");
  await tx.delete(cronogramas).where(and(eq(cronogramas.propuestaId, propuestaId), eq(cronogramas.estado, "propuesto")));
  const [{ max }] = await tx.select({ max: sql<number>`coalesce(max(${cronogramas.version}),0)::int` }).from(cronogramas).where(eq(cronogramas.propuestaId, propuestaId));
  const cr = await insertarCronograma(tx, actor.organizacionId, propuestaId, datos, max + 1, "propuesto");
  await anotar(tx, actor.organizacionId, propuestaId, "Nuevo cronograma propuesto", `Versión ${cr.version}, inicia ${datos.fechaInicio}`, actor.usuarioNombre);
  return cr;
}

export async function aceptarNuevoCronograma(tx: Ejecutor, propuestaId: string, hoy: string, ahora = new Date()) {
  const [nuevo] = await tx
    .select()
    .from(cronogramas)
    .where(and(eq(cronogramas.propuestaId, propuestaId), eq(cronogramas.estado, "propuesto")))
    .orderBy(desc(cronogramas.version))
    .limit(1);
  if (!nuevo) throw new Error("No hay un cronograma nuevo por aceptar.");
  const [p] = await tx.select().from(propuestas).where(eq(propuestas.id, propuestaId));
  if (!p?.aceptadaEn) throw new Error("Primero acepta la propuesta.");
  await tx.update(cronogramas).set({ estado: "reemplazado" }).where(and(eq(cronogramas.propuestaId, propuestaId), eq(cronogramas.estado, "aceptado")));
  await tx.update(cronogramas).set({ estado: "aceptado", aceptadoEn: ahora }).where(eq(cronogramas.id, nuevo.id));
  await tx.update(propuestas).set({ requiereNuevoCronograma: false }).where(eq(propuestas.id, propuestaId));
  await anotar(tx, p.organizacionId, propuestaId, "Nuevo cronograma aceptado por el estudiante", `Versión ${nuevo.version}`, "estudiante");
  return sincronizarProyecto(tx, propuestaId, hoy, ahora);
}

export async function cambiarEstadoManual(tx: Ejecutor, actor: Actor, propuestaId: string, estado: Extract<EstadoProyecto, "tribunal" | "finalizado" | "en_curso">) {
  const [p] = await tx.select().from(propuestas).where(eq(propuestas.id, propuestaId));
  if (!p?.aceptadaEn) throw new Error("El proyecto aún no fue aceptado.");
  await tx.update(propuestas).set({ estado, actualizadoEn: new Date() }).where(eq(propuestas.id, propuestaId));
  await anotar(tx, actor.organizacionId, propuestaId, `Estado: ${p.estado} → ${estado}`, "Cambio manual", actor.usuarioNombre);
}

export async function marcarActividad(tx: Ejecutor, actividadId: string, hecha: boolean) {
  await tx.update(actividades).set({ hecha, hechaEn: hecha ? new Date() : null }).where(eq(actividades.id, actividadId));
}

export async function guardarNotas(tx: Ejecutor, propuestaId: string, notas: string) {
  await tx.update(propuestas).set({ notas: notas.slice(0, 5000) }).where(eq(propuestas.id, propuestaId));
}

/** Agrega al plan una cuota por un cobro adicional (3.ª revisión o extra), con historial en Cobros. */
export async function agregarCobroAdicional(tx: Ejecutor, actor: Actor, planId: string, concepto: string, montoCentavos: number, fecha: string) {
  const plan = await obtenerPlanCompleto(tx, planId);
  if (!plan) throw new Error("Plan no encontrado");
  const lista: CuotaEditable[] = [
    ...plan.cuotas.map((c) => ({ id: c.id, concepto: c.concepto, montoCentavos: c.montoCentavos, fechaVencimiento: c.fechaVencimiento })),
    { concepto, montoCentavos, fechaVencimiento: fecha },
  ];
  await guardarCuotas(tx, actor, planId, lista);
  const [nueva] = await tx.select().from(cuotas).where(eq(cuotas.planId, planId)).orderBy(desc(cuotas.numero)).limit(1);
  return nueva;
}

export async function solicitarTerceraRevision(tx: Ejecutor, propuestaId: string) {
  const [p] = await tx.select().from(propuestas).where(eq(propuestas.id, propuestaId));
  if (!p?.aceptadaEn) throw new Error("El proyecto aún no fue aceptado.");
  const [ya] = await tx.select().from(revisiones).where(and(eq(revisiones.propuestaId, propuestaId), eq(revisiones.numero, 3)));
  if (ya) throw new Error("La 3.ª revisión ya fue solicitada.");
  await tx.insert(revisiones).values({ organizacionId: p.organizacionId, propuestaId, numero: 3, incluida: false, precioCentavos: p.precioTerceraRevisionCentavos, estado: "solicitada", solicitadaEn: new Date() });
  await anotar(tx, p.organizacionId, propuestaId, "El estudiante pidió la 3.ª revisión", null, "estudiante");
}

export async function solicitarExtra(tx: Ejecutor, propuestaId: string, extraId: string) {
  const [x] = await tx.select().from(propuestaExtras).where(and(eq(propuestaExtras.id, extraId), eq(propuestaExtras.propuestaId, propuestaId)));
  if (!x) throw new Error("Extra no encontrado");
  if (x.estado !== "ofrecido") throw new Error("Este extra ya fue solicitado.");
  await tx.update(propuestaExtras).set({ estado: "solicitado", solicitadoEn: new Date() }).where(eq(propuestaExtras.id, extraId));
  await anotar(tx, x.organizacionId, propuestaId, `El estudiante pidió: ${x.nombre}`, null, "estudiante");
}

/** La asesora aprueba una 3.ª revisión o un extra solicitado: se agrega la cuota al plan. */
export async function aprobarSolicitud(tx: Ejecutor, actor: Actor, propuestaId: string, tipo: "revision" | "extra", refId: string, hoy: string) {
  const [p] = await tx.select().from(propuestas).where(eq(propuestas.id, propuestaId));
  if (!p) throw new Error("Propuesta no encontrada");
  const vence = sumarDias(hoy, 7);
  if (tipo === "revision") {
    const [r] = await tx.select().from(revisiones).where(and(eq(revisiones.id, refId), eq(revisiones.propuestaId, propuestaId)));
    if (!r || r.estado !== "solicitada") throw new Error("No hay una solicitud de revisión pendiente.");
    const c = r.precioCentavos > 0 ? await agregarCobroAdicional(tx, actor, p.planId, `Revisión ${r.numero} del tribunal`, r.precioCentavos, vence) : null;
    await tx.update(revisiones).set({ estado: "aprobada", cuotaId: c?.id ?? null }).where(eq(revisiones.id, r.id));
    await anotar(tx, actor.organizacionId, propuestaId, `3.ª revisión aprobada`, c ? `Cuota agregada (${(r.precioCentavos / 100).toFixed(2)})` : null, actor.usuarioNombre);
  } else {
    const [x] = await tx.select().from(propuestaExtras).where(and(eq(propuestaExtras.id, refId), eq(propuestaExtras.propuestaId, propuestaId)));
    if (!x || x.estado !== "solicitado") throw new Error("No hay una solicitud de extra pendiente.");
    const c = x.precioCentavos > 0 ? await agregarCobroAdicional(tx, actor, p.planId, x.nombre, x.precioCentavos, vence) : null;
    await tx.update(propuestaExtras).set({ estado: "aprobado", cuotaId: c?.id ?? null }).where(eq(propuestaExtras.id, x.id));
    await anotar(tx, actor.organizacionId, propuestaId, `Extra aprobado: ${x.nombre}`, null, actor.usuarioNombre);
  }
}

export async function marcarRevision(tx: Ejecutor, revisionId: string, hecha: boolean) {
  await tx.update(revisiones).set({ estado: hecha ? "hecha" : "pendiente", hechaEn: hecha ? new Date() : null }).where(eq(revisiones.id, revisionId));
}

export async function listarPropuestas(tx: Ejecutor) {
  return tx
    .select({ propuesta: propuestas, cliente: { id: clientes.id, nombre: clientes.nombre, whatsapp: clientes.whatsapp } })
    .from(propuestas)
    .innerJoin(clientes, eq(clientes.id, propuestas.clienteId))
    .orderBy(desc(propuestas.actualizadoEn))
    .limit(500);
}

/** Todo lo necesario para la ficha del proyecto y el portal del estudiante. */
export async function obtenerProyecto(tx: Ejecutor, id: string) {
  const [fila] = await tx.select({ propuesta: propuestas, cliente: clientes }).from(propuestas).innerJoin(clientes, eq(clientes.id, propuestas.clienteId)).where(eq(propuestas.id, id));
  if (!fila) return null;
  const plan = await obtenerPlanCompleto(tx, fila.propuesta.planId);
  const crs = await tx.select().from(cronogramas).where(eq(cronogramas.propuestaId, id)).orderBy(desc(cronogramas.version));
  const acts = crs.length ? await tx.select().from(actividades).where(inArray(actividades.cronogramaId, crs.map((c) => c.id))).orderBy(asc(actividades.orden)) : [];
  const conActs = crs.map((c) => ({ ...c, actividades: acts.filter((a) => a.cronogramaId === c.id) }));
  const vigente = conActs.find((c) => c.estado === "aceptado") ?? conActs.find((c) => c.estado === "propuesto") ?? null;
  const nuevoPendiente = fila.propuesta.aceptadaEn ? (conActs.find((c) => c.estado === "propuesto") ?? null) : null;
  const revs = await tx.select().from(revisiones).where(eq(revisiones.propuestaId, id)).orderBy(asc(revisiones.numero));
  const extras = await tx.select().from(propuestaExtras).where(eq(propuestaExtras.propuestaId, id));
  const historial = await tx.select().from(historialPropuesta).where(eq(historialPropuesta.propuestaId, id)).orderBy(desc(historialPropuesta.creadoEn)).limit(200);
  const files = await tx
    .select({ id: archivosProyecto.id, archivoId: archivos.id, nombre: archivos.nombreOriginal, tamano: archivos.tamanoBytes, origen: archivosProyecto.origen, descripcion: archivosProyecto.descripcion, creadoEn: archivosProyecto.creadoEn })
    .from(archivosProyecto)
    .innerJoin(archivos, eq(archivos.id, archivosProyecto.archivoId))
    .where(eq(archivosProyecto.propuestaId, id))
    .orderBy(desc(archivosProyecto.creadoEn));
  const respuestas = await tx.select().from(respuestasFormulario).where(eq(respuestasFormulario.propuestaId, id));
  const [enlace] = await tx
    .select()
    .from(enlacesPortal)
    .where(and(eq(enlacesPortal.planId, fila.propuesta.planId), sql`${enlacesPortal.token} is not null`))
    .orderBy(desc(enlacesPortal.creadoEn))
    .limit(1);
  return { propuesta: fila.propuesta, cliente: fila.cliente, plan: plan!, cronogramas: conActs, vigente, nuevoPendiente, revisiones: revs, extras, historial, archivos: files, respuestas, enlace: enlace ?? null };
}
export type Proyecto = NonNullable<Awaited<ReturnType<typeof obtenerProyecto>>>;

/**
 * Elimina una propuesta/proyecto con todo lo suyo: cronogramas, revisiones, extras, respuestas, historial, archivos
 * del proyecto y su plan de pagos en Cobros (cuotas, pagos, enlaces). Devuelve las rutas a borrar del disco.
 */
export async function eliminarPropuesta(tx: Ejecutor, id: string): Promise<string[]> {
  const [p] = await tx.select().from(propuestas).where(eq(propuestas.id, id));
  if (!p) throw new Error("Propuesta no encontrada");
  const delProyecto = await tx.select({ id: archivosProyecto.archivoId }).from(archivosProyecto).where(eq(archivosProyecto.propuestaId, id));
  await tx.delete(propuestas).where(eq(propuestas.id, id));
  const rutas = await quitarFilasArchivos(tx, delProyecto.map((a) => a.id));
  return [...rutas, ...(await eliminarPlan(tx, p.planId))];
}

/** Propuestas de un estudiante (para eliminar al cliente desde la capa de rutas). */
export async function propuestasDeCliente(tx: Ejecutor, clienteId: string) {
  return tx.select({ id: propuestas.id }).from(propuestas).where(eq(propuestas.clienteId, clienteId));
}

/** ¿Este plan es el de una propuesta? (Cobros no conoce a Tesis: lo pregunta la capa de rutas.) */
export async function propuestaDePlan(tx: Ejecutor, planId: string) {
  const [p] = await tx.select({ id: propuestas.id }).from(propuestas).where(eq(propuestas.planId, planId));
  return p ?? null;
}
