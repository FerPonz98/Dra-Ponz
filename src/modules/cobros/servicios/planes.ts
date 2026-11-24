import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import type { Ejecutor } from "@/lib/db";
import { calcularCambiosCuotas, calcularTotal, cambiosReglas, esquemaCuota, esquemaReglasMora, REGLAS_VACIAS, type CambioHistorial, type CuotaEditable, type ReglasMora } from "@/modules/cobros/dominio/plan";
import { evaluarMora, recargosNuevos } from "@/modules/cobros/dominio/mora";
import { clientes, cuotas, enlacesPortal, historialPlan, MONEDAS, pagos, planesPago, recargos, type Moneda } from "@/modules/cobros/schema";

export type Actor = { organizacionId: string; usuarioId: string | null; usuarioNombre: string | null };

export const esquemaPlan = z.object({
  clienteId: z.uuid("Elige un cliente"),
  titulo: z.string().trim().min(2, "Escribe un concepto").max(200),
  moneda: z.enum(MONEDAS),
  cuotas: z.array(esquemaCuota).min(1, "Agrega al menos una cuota").max(120),
  reglas: esquemaReglasMora.default(REGLAS_VACIAS),
});
export type DatosPlan = z.input<typeof esquemaPlan>;

export type Plan = typeof planesPago.$inferSelect;

export function reglasDePlan(p: Plan): ReglasMora {
  return {
    plazoPrimeraCuotaDias: p.plazoPrimeraCuotaDias,
    diasGracia: p.diasGracia,
    recargoActivo: p.recargoActivo,
    recargoPorcentaje: p.recargoPorcentaje === null ? null : Number(p.recargoPorcentaje),
    recargoModo: p.recargoModo,
    diasGraciaNuevaMora: p.diasGraciaNuevaMora,
  };
}

const columnasReglas = (r: ReglasMora) => ({
  plazoPrimeraCuotaDias: r.plazoPrimeraCuotaDias,
  diasGracia: r.diasGracia,
  recargoActivo: r.recargoActivo,
  recargoPorcentaje: r.recargoPorcentaje === null ? null : r.recargoPorcentaje.toFixed(2),
  recargoModo: r.recargoModo,
  diasGraciaNuevaMora: r.diasGraciaNuevaMora,
});

async function anotar(tx: Ejecutor, actor: Actor, planId: string, cambios: CambioHistorial[]) {
  if (!cambios.length) return;
  await tx.insert(historialPlan).values(
    cambios.map((c) => ({
      organizacionId: actor.organizacionId,
      planId,
      cuotaId: c.cuotaId,
      usuarioId: actor.usuarioId,
      usuarioNombre: actor.usuarioNombre,
      campo: c.campo,
      valorAntes: c.valorAntes,
      valorDespues: c.valorDespues,
    })),
  );
}

export async function crearPlan(tx: Ejecutor, actor: Actor, datos: DatosPlan & { origen?: string; aceptado?: boolean }) {
  const d = esquemaPlan.parse(datos);
  const [p] = await tx
    .insert(planesPago)
    .values({
      organizacionId: actor.organizacionId,
      clienteId: d.clienteId,
      titulo: d.titulo,
      moneda: d.moneda,
      origen: datos.origen ?? null,
      aceptadoEn: datos.aceptado === false ? null : new Date(),
      ...columnasReglas(d.reglas),
    })
    .returning();
  await tx.insert(cuotas).values(
    d.cuotas.map((c, i) => ({ organizacionId: actor.organizacionId, planId: p.id, numero: i + 1, concepto: c.concepto ?? null, montoCentavos: c.montoCentavos, fechaVencimiento: c.fechaVencimiento })),
  );
  await anotar(tx, actor, p.id, [{ cuotaId: null, campo: "plan creado", valorAntes: null, valorDespues: `${d.cuotas.length} ${d.cuotas.length === 1 ? "cuota" : "cuotas"} · total ${(calcularTotal(d.cuotas) / 100).toFixed(2)} ${d.moneda}` }]);
  return p;
}

/** Reemplaza las cuotas de un plan (agregar, quitar, editar montos y fechas) registrando el historial. */
export async function guardarCuotas(tx: Ejecutor, actor: Actor, planId: string, nuevas: CuotaEditable[]) {
  const lista = z.array(esquemaCuota).min(1, "El plan necesita al menos una cuota").max(120).parse(nuevas);
  const antes = await tx.select().from(cuotas).where(eq(cuotas.planId, planId)).orderBy(asc(cuotas.numero));
  const cambios = calcularCambiosCuotas(antes, lista);
  for (const id of cambios.eliminar) {
    const [pend] = await tx.select({ n: sql<number>`count(*)::int` }).from(pagos).where(and(eq(pagos.cuotaId, id), eq(pagos.estado, "pendiente")));
    if (pend.n > 0) throw new Error("No se puede quitar una cuota con un comprobante pendiente de revisión.");
    await tx.delete(cuotas).where(eq(cuotas.id, id));
  }
  for (const u of cambios.actualizar) {
    await tx.update(cuotas).set({ numero: u.numero, montoCentavos: u.montoCentavos, fechaVencimiento: u.fechaVencimiento, concepto: u.concepto }).where(eq(cuotas.id, u.id));
  }
  if (cambios.crear.length) {
    await tx.insert(cuotas).values(
      cambios.crear.map((c) => ({ organizacionId: actor.organizacionId, planId, numero: c.numero, concepto: c.concepto ?? null, montoCentavos: c.montoCentavos, fechaVencimiento: c.fechaVencimiento })),
    );
  }
  await anotar(tx, actor, planId, cambios.historial);
  const hayPendientes = lista.length > antes.filter((a) => a.estado === "pagada").length;
  await tx
    .update(planesPago)
    .set({ actualizadoEn: new Date(), ...(hayPendientes ? { estado: sql`case when ${planesPago.estado} = 'finalizado' then 'activo' else ${planesPago.estado} end` } : {}) })
    .where(eq(planesPago.id, planId));
  return cambios;
}

export async function guardarReglas(tx: Ejecutor, actor: Actor, planId: string, reglas: ReglasMora) {
  const r = esquemaReglasMora.parse(reglas);
  const [p] = await tx.select().from(planesPago).where(eq(planesPago.id, planId));
  if (!p) throw new Error("Plan no encontrado");
  await anotar(tx, actor, planId, cambiosReglas(reglasDePlan(p), r));
  await tx.update(planesPago).set({ ...columnasReglas(r), actualizadoEn: new Date() }).where(eq(planesPago.id, planId));
}

export async function cambiarMonedaYTitulo(tx: Ejecutor, actor: Actor, planId: string, d: { titulo?: string; moneda?: Moneda; clienteId?: string }) {
  const [p] = await tx.select().from(planesPago).where(eq(planesPago.id, planId));
  if (!p) throw new Error("Plan no encontrado");
  const cambios: CambioHistorial[] = [];
  if (d.titulo !== undefined && d.titulo !== p.titulo) cambios.push({ cuotaId: null, campo: "concepto", valorAntes: p.titulo, valorDespues: d.titulo });
  if (d.moneda !== undefined && d.moneda !== p.moneda) cambios.push({ cuotaId: null, campo: "moneda", valorAntes: p.moneda, valorDespues: d.moneda });
  if (d.clienteId !== undefined && d.clienteId !== p.clienteId) cambios.push({ cuotaId: null, campo: "cliente", valorAntes: p.clienteId, valorDespues: d.clienteId });
  if (!cambios.length) return;
  await anotar(tx, actor, planId, cambios);
  await tx.update(planesPago).set({ titulo: d.titulo ?? p.titulo, moneda: d.moneda ?? p.moneda, clienteId: d.clienteId ?? p.clienteId, actualizadoEn: new Date() }).where(eq(planesPago.id, planId));
}

export async function marcarAceptado(tx: Ejecutor, actor: Actor, planId: string, cuando = new Date()) {
  await tx.update(planesPago).set({ aceptadoEn: cuando }).where(eq(planesPago.id, planId));
  await anotar(tx, actor, planId, [{ cuotaId: null, campo: "plan aceptado", valorAntes: null, valorDespues: cuando.toISOString() }]);
}

export async function listarPlanes(tx: Ejecutor, filtro?: { clienteId?: string }) {
  const filas = await tx
    .select({
      plan: planesPago,
      cliente: { id: clientes.id, nombre: clientes.nombre, whatsapp: clientes.whatsapp },
      total: sql<number>`(select coalesce(sum(${cuotas.montoCentavos}),0)::int from ${cuotas} where ${cuotas.planId} = ${planesPago.id})`,
      pagado: sql<number>`(select coalesce(sum(${cuotas.montoCentavos}),0)::int from ${cuotas} where ${cuotas.planId} = ${planesPago.id} and ${cuotas.estado} = 'pagada')`,
    })
    .from(planesPago)
    .innerJoin(clientes, eq(clientes.id, planesPago.clienteId))
    .where(filtro?.clienteId ? eq(planesPago.clienteId, filtro.clienteId) : undefined)
    .orderBy(desc(planesPago.creadoEn))
    .limit(500);
  return filas;
}

export type CuotaDetalle = typeof cuotas.$inferSelect & { recargoCentavos: number; aPagarCentavos: number; pagoPendiente: boolean };

export async function obtenerPlanCompleto(tx: Ejecutor, planId: string) {
  const [fila] = await tx.select({ plan: planesPago, cliente: clientes }).from(planesPago).innerJoin(clientes, eq(clientes.id, planesPago.clienteId)).where(eq(planesPago.id, planId));
  if (!fila) return null;
  const lista = await tx.select().from(cuotas).where(eq(cuotas.planId, planId)).orderBy(asc(cuotas.numero));
  const ids = lista.map((c) => c.id);
  const recs = ids.length ? await tx.select().from(recargos).where(inArray(recargos.cuotaId, ids)).orderBy(asc(recargos.aplicadoEn)) : [];
  const pagosPlan = await tx.select().from(pagos).where(eq(pagos.planId, planId)).orderBy(desc(pagos.creadoEn));
  const historial = await tx.select().from(historialPlan).where(eq(historialPlan.planId, planId)).orderBy(desc(historialPlan.creadoEn)).limit(200);
  const enlaces = await tx.select().from(enlacesPortal).where(eq(enlacesPortal.planId, planId)).orderBy(desc(enlacesPortal.creadoEn));
  const cuotasDetalle: CuotaDetalle[] = lista.map((c) => {
    const recargo = recs.filter((r) => r.cuotaId === c.id).reduce((s, r) => s + r.montoCentavos, 0);
    return { ...c, recargoCentavos: recargo, aPagarCentavos: c.montoCentavos + recargo, pagoPendiente: pagosPlan.some((p) => p.cuotaId === c.id && p.estado === "pendiente") };
  });
  return {
    plan: fila.plan,
    cliente: fila.cliente,
    reglas: reglasDePlan(fila.plan),
    cuotas: cuotasDetalle,
    recargos: recs,
    pagos: pagosPlan,
    historial,
    enlaces,
    total: calcularTotal(lista),
    totalRecargos: recs.reduce((s, r) => s + r.montoCentavos, 0),
    pagado: lista.filter((c) => c.estado === "pagada").reduce((s, c) => s + c.montoCentavos, 0),
  };
}
export type PlanCompleto = NonNullable<Awaited<ReturnType<typeof obtenerPlanCompleto>>>;

/** Recalcula estado de mora y recargos de un plan para `hoy`. Idempotente (no duplica recargos). */
export async function recalcularMora(tx: Ejecutor, planId: string, hoy: string, zona?: string) {
  return (await recalcularMoraLote(tx, [planId], hoy, zona)).get(planId) ?? null;
}

export type ResultadoMoraPlan = ReturnType<typeof evaluarMora> & { recargosAgregados: number; estadoAnterior: Plan["estadoMora"] };

const LOTE = 2000;
async function porLotes<T, R>(xs: T[], fn: (lote: T[]) => Promise<R[]>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < xs.length; i += LOTE) out.push(...(await fn(xs.slice(i, i + LOTE))));
  return out;
}

/**
 * Recalcula mora y recargos de muchos planes con pocas consultas (por lotes, sin N+1): lee planes, cuotas,
 * pagos en revisión y recargos existentes de una vez, evalúa en memoria (mismas reglas: evaluarMora) y escribe
 * por lotes. Idempotente: los recargos van con ON CONFLICT DO NOTHING sobre (cuota, número).
 */
export async function recalcularMoraLote(tx: Ejecutor, planIds: string[], hoy: string, zona?: string): Promise<Map<string, ResultadoMoraPlan>> {
  const resultado = new Map<string, ResultadoMoraPlan>();
  if (!planIds.length) return resultado;
  const planes = (await porLotes(planIds, (l) => tx.select().from(planesPago).where(inArray(planesPago.id, l)))).filter((p) => p.estado === "activo" && p.aceptadoEn);
  if (!planes.length) return resultado;
  const ids = planes.map((p) => p.id);
  const todas = await porLotes(ids, (l) => tx.select().from(cuotas).where(inArray(cuotas.planId, l)));
  const enRevision = new Set((await porLotes(ids, (l) => tx.select({ cuotaId: pagos.cuotaId }).from(pagos).where(and(inArray(pagos.planId, l), eq(pagos.estado, "pendiente"))))).map((x) => x.cuotaId));
  const existentes = await porLotes(ids, (l) => tx.select({ cuotaId: recargos.cuotaId, numero: recargos.numero, planId: cuotas.planId }).from(recargos).innerJoin(cuotas, eq(cuotas.id, recargos.cuotaId)).where(inArray(cuotas.planId, l)));
  const cuotasDe = new Map<string, (typeof todas)[number][]>();
  for (const c of todas) cuotasDe.set(c.planId, [...(cuotasDe.get(c.planId) ?? []), c]);
  const recargosDe = new Map<string, { cuotaId: string; numero: number }[]>();
  for (const r of existentes) recargosDe.set(r.planId, [...(recargosDe.get(r.planId) ?? []), r]);

  const insertar: (typeof recargos.$inferInsert)[] = [];
  const cambios: { id: string; estado: Plan["estadoMora"]; n: number; antes: Plan["estadoMora"]; org: string }[] = [];
  const finalizados: string[] = [];
  for (const p of planes) {
    const lista = cuotasDe.get(p.id) ?? [];
    const r = evaluarMora(
      { reglas: reglasDePlan(p), aceptadoEn: p.aceptadoEn!, numeroMoras: p.numeroMoras, estadoMora: p.estadoMora, zona },
      lista.map((c) => ({ ...c, pagoEnRevision: enRevision.has(c.id) })),
      hoy,
    );
    const nuevos = recargosNuevos(r.recargos, recargosDe.get(p.id) ?? []);
    for (const n of nuevos) insertar.push({ organizacionId: p.organizacionId, cuotaId: n.cuotaId, numero: n.numero, porcentaje: n.porcentaje.toFixed(2), montoCentavos: n.montoCentavos, aplicadoEn: n.aplicadoEn });
    if (r.estadoMora !== p.estadoMora || r.numeroMoras !== p.numeroMoras) cambios.push({ id: p.id, estado: r.estadoMora, n: r.numeroMoras, antes: p.estadoMora, org: p.organizacionId });
    if (lista.length > 0 && lista.every((c) => c.estado === "pagada")) finalizados.push(p.id);
    resultado.set(p.id, { ...r, recargosAgregados: nuevos.length, estadoAnterior: p.estadoMora });
  }

  for (let i = 0; i < insertar.length; i += 1000) await tx.insert(recargos).values(insertar.slice(i, i + 1000)).onConflictDoNothing();
  for (let i = 0; i < cambios.length; i += 1000) {
    const l = cambios.slice(i, i + 1000);
    await tx.execute(sql`update planes_pago p set estado_mora = v.estado, numero_moras = v.n
      from (values ${sql.join(l.map((c) => sql`(${c.id}::uuid, ${c.estado}::text, ${c.n}::int)`), sql`, `)}) as v(id, estado, n)
      where p.id = v.id`);
    await tx.insert(historialPlan).values(l.map((c) => ({ organizacionId: c.org, planId: c.id, campo: "estado de mora", valorAntes: c.antes, valorDespues: c.estado, usuarioNombre: "sistema" })));
  }
  for (let i = 0; i < finalizados.length; i += LOTE) await tx.update(planesPago).set({ estado: "finalizado" }).where(inArray(planesPago.id, finalizados.slice(i, i + LOTE)));
  return resultado;
}

export async function idsPlanesActivos(tx: Ejecutor) {
  return (await tx.select({ id: planesPago.id }).from(planesPago).where(eq(planesPago.estado, "activo"))).map((x) => x.id);
}
