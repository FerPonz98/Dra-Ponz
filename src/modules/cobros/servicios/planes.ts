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
  await anotar(tx, actor, p.id, [{ cuotaId: null, campo: "plan creado", valorAntes: null, valorDespues: `${d.cuotas.length} cuotas · total ${(calcularTotal(d.cuotas) / 100).toFixed(2)} ${d.moneda}` }]);
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
  const [p] = await tx.select().from(planesPago).where(eq(planesPago.id, planId));
  if (!p || p.estado !== "activo") return null;
  const lista = await tx.select().from(cuotas).where(eq(cuotas.planId, planId));
  const pendientes = await tx.select({ cuotaId: pagos.cuotaId }).from(pagos).where(and(eq(pagos.planId, planId), eq(pagos.estado, "pendiente")));
  const enRevision = new Set(pendientes.map((x) => x.cuotaId));
  const r = evaluarMora(
    { reglas: reglasDePlan(p), aceptadoEn: p.aceptadoEn, numeroMoras: p.numeroMoras, estadoMora: p.estadoMora, zona },
    lista.map((c) => ({ ...c, pagoEnRevision: enRevision.has(c.id) })),
    hoy,
  );
  const ids = lista.map((c) => c.id);
  const existentes = ids.length ? await tx.select({ cuotaId: recargos.cuotaId, numero: recargos.numero }).from(recargos).where(inArray(recargos.cuotaId, ids)) : [];
  const nuevos = recargosNuevos(r.recargos, existentes);
  if (nuevos.length) {
    await tx
      .insert(recargos)
      .values(nuevos.map((n) => ({ organizacionId: p.organizacionId, cuotaId: n.cuotaId, numero: n.numero, porcentaje: n.porcentaje.toFixed(2), montoCentavos: n.montoCentavos, aplicadoEn: n.aplicadoEn })))
      .onConflictDoNothing();
  }
  if (r.estadoMora !== p.estadoMora || r.numeroMoras !== p.numeroMoras) {
    await tx.update(planesPago).set({ estadoMora: r.estadoMora, numeroMoras: r.numeroMoras }).where(eq(planesPago.id, planId));
    await tx.insert(historialPlan).values({ organizacionId: p.organizacionId, planId, campo: "estado de mora", valorAntes: p.estadoMora, valorDespues: r.estadoMora, usuarioNombre: "sistema" });
  }
  const todasPagadas = lista.length > 0 && lista.every((c) => c.estado === "pagada");
  if (todasPagadas) await tx.update(planesPago).set({ estado: "finalizado" }).where(eq(planesPago.id, planId));
  return { ...r, recargosAgregados: nuevos.length, estadoAnterior: p.estadoMora };
}

export async function idsPlanesActivos(tx: Ejecutor) {
  return (await tx.select({ id: planesPago.id }).from(planesPago).where(eq(planesPago.estado, "activo"))).map((x) => x.id);
}
