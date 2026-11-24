import { and, asc, eq, gte, inArray, lt, lte, sql } from "drizzle-orm";
import { archivos } from "@/core/db/schema";
import type { Ejecutor } from "@/lib/db";
import { sumarDias, sumarMeses } from "@/lib/fechas";
import { clientes, cuotas, enlacesPortal, pagos, planesPago, recargos, type Moneda } from "@/modules/cobros/schema";
import type { ClavePlantilla } from "@/modules/cobros/dominio/mensajes";
import { urlPortal } from "./enlaces";
import { cargarPlantillas, vars } from "./mensajes";

export type CategoriaRecordatorio = "vence_en_3_dias" | "vence_hoy" | "vencida" | "en_cola";

const PLANTILLA: Record<CategoriaRecordatorio, ClavePlantilla> = {
  vence_en_3_dias: "recordatorio",
  vence_hoy: "recordatorio",
  vencida: "cuota_vencida",
  en_cola: "en_cola",
};

/** Lista "para recordar hoy": cuotas que vencen en 3 días, hoy, vencidas (en gracia) y en cola. */
export async function recordatoriosDeHoy(tx: Ejecutor, hoy: string) {
  const filas = await tx
    .select({ cuota: cuotas, plan: planesPago, cliente: clientes })
    .from(cuotas)
    .innerJoin(planesPago, eq(planesPago.id, cuotas.planId))
    .innerJoin(clientes, eq(clientes.id, planesPago.clienteId))
    .where(and(eq(cuotas.estado, "pendiente"), eq(planesPago.estado, "activo"), lte(cuotas.fechaVencimiento, sumarDias(hoy, 3))))
    .orderBy(asc(cuotas.fechaVencimiento));
  const planIds = [...new Set(filas.map((f) => f.plan.id))];
  const enlaces = planIds.length ? await tx.select().from(enlacesPortal).where(and(inArray(enlacesPortal.planId, planIds), sql`${enlacesPortal.token} is not null`)) : [];
  const cuotaIds = filas.map((f) => f.cuota.id);
  const recs = cuotaIds.length ? await tx.select({ cuotaId: recargos.cuotaId, monto: recargos.montoCentavos }).from(recargos).where(inArray(recargos.cuotaId, cuotaIds)) : [];
  const enRevision = cuotaIds.length ? await tx.select({ cuotaId: pagos.cuotaId }).from(pagos).where(and(inArray(pagos.cuotaId, cuotaIds), eq(pagos.estado, "pendiente"))) : [];
  const revision = new Set(enRevision.map((x) => x.cuotaId));
  // Mapas en vez de búsquedas lineales, y las plantillas en una sola consulta (antes: una consulta por fila).
  const recargoDe = new Map<string, number>();
  for (const r of recs) recargoDe.set(r.cuotaId, (recargoDe.get(r.cuotaId) ?? 0) + r.monto);
  const enlaceDe = new Map(enlaces.map((e) => [e.planId, e]));
  const redactar = await cargarPlantillas(tx);

  const salida: { categoria: CategoriaRecordatorio; cuotaId: string; numero: number; fecha: string; montoCentavos: number; moneda: Moneda; plan: { id: string; titulo: string }; cliente: { id: string; nombre: string; whatsapp: string | null }; mensaje: string }[] = [];
  for (const f of filas) {
    if (revision.has(f.cuota.id)) continue;
    let categoria: CategoriaRecordatorio;
    if (f.cuota.fechaVencimiento > hoy) categoria = "vence_en_3_dias";
    else if (f.cuota.fechaVencimiento === hoy) categoria = "vence_hoy";
    else categoria = f.plan.estadoMora === "en_cola" ? "en_cola" : "vencida";
    const monto = f.cuota.montoCentavos + (recargoDe.get(f.cuota.id) ?? 0);
    const e = enlaceDe.get(f.plan.id);
    const texto = redactar(PLANTILLA[categoria], vars({ nombre: f.cliente.nombre, montoCentavos: monto, moneda: f.plan.moneda, fecha: f.cuota.fechaVencimiento, enlace: e?.token ? urlPortal(e.token) : null, proyecto: f.plan.titulo }));
    salida.push({
      categoria,
      cuotaId: f.cuota.id,
      numero: f.cuota.numero,
      fecha: f.cuota.fechaVencimiento,
      montoCentavos: monto,
      moneda: f.plan.moneda,
      plan: { id: f.plan.id, titulo: f.plan.titulo },
      cliente: { id: f.cliente.id, nombre: f.cliente.nombre, whatsapp: f.cliente.whatsapp },
      mensaje: texto,
    });
  }
  return salida;
}

type PorMoneda = Record<Moneda, number>;
const cero = (): PorMoneda => ({ BOB: 0, BRL: 0 });

/** Resumen del panel: cobrado este mes (Bs), por cobrar, vencido y en cola. */
export async function resumenPanel(tx: Ejecutor, hoy: string, zona: string) {
  const inicioMes = `${hoy.slice(0, 8)}01`;
  const finMes = sumarMeses(inicioMes, 1);
  const [cobrado] = await tx
    .select({ total: sql<number>`coalesce(sum(${pagos.montoBobCentavos}),0)::int` })
    .from(pagos)
    .where(and(eq(pagos.estado, "aprobado"), gte(sql`(${pagos.revisadoEn} at time zone ${zona})::date`, inicioMes), lt(sql`(${pagos.revisadoEn} at time zone ${zona})::date`, finMes)));

  const pendientes = await tx
    .select({
      moneda: planesPago.moneda,
      estadoMora: planesPago.estadoMora,
      fecha: cuotas.fechaVencimiento,
      monto: sql<number>`(${cuotas.montoCentavos} + coalesce((select sum(${recargos.montoCentavos}) from ${recargos} where ${recargos.cuotaId} = ${cuotas.id}),0))::int`,
    })
    .from(cuotas)
    .innerJoin(planesPago, eq(planesPago.id, cuotas.planId))
    .where(and(eq(cuotas.estado, "pendiente"), eq(planesPago.estado, "activo")));
  const porCobrar = cero();
  const vencido = cero();
  for (const p of pendientes) {
    porCobrar[p.moneda] += p.monto;
    if (p.fecha < hoy) vencido[p.moneda] += p.monto;
  }
  const [cola] = await tx.select({ n: sql<number>`count(*)::int` }).from(planesPago).where(and(eq(planesPago.estado, "activo"), eq(planesPago.estadoMora, "en_cola")));
  const [porAprobar] = await tx.select({ n: sql<number>`count(*)::int` }).from(pagos).where(eq(pagos.estado, "pendiente"));
  return { cobradoMesBob: cobrado.total, porCobrar, vencido, planesEnCola: cola.n, comprobantesPorAprobar: porAprobar.n };
}

/** Series para los mini gráficos del inicio. Montos en centavos (BOB para lo cobrado; por moneda para lo pendiente). */
export async function seriesPanel(tx: Ejecutor, hoy: string, zona: string) {
  const inicioMes = `${hoy.slice(0, 8)}01`;
  const meses = Array.from({ length: 6 }, (_, i) => sumarMeses(inicioMes, i - 5));
  const cobradas = await tx
    .select({ mes: sql<string>`to_char((${pagos.revisadoEn} at time zone ${zona})::date, 'YYYY-MM')`, total: sql<number>`sum(${pagos.montoBobCentavos})::int` })
    .from(pagos)
    .where(and(eq(pagos.estado, "aprobado"), gte(sql`(${pagos.revisadoEn} at time zone ${zona})::date`, meses[0])))
    .groupBy(sql`1`);
  const cobrado = meses.map((m) => cobradas.find((x) => x.mes === m.slice(0, 7))?.total ?? 0);

  const pendientes = await tx
    .select({ fecha: cuotas.fechaVencimiento, moneda: planesPago.moneda, monto: cuotas.montoCentavos })
    .from(cuotas)
    .innerJoin(planesPago, eq(planesPago.id, cuotas.planId))
    .where(and(eq(cuotas.estado, "pendiente"), eq(planesPago.estado, "activo")));
  const proximos = Array.from({ length: 6 }, (_, i) => sumarMeses(inicioMes, i));
  const porCobrar = proximos.map((m) => pendientes.filter((p) => p.fecha.slice(0, 7) === m.slice(0, 7)).reduce((s, p) => s + p.monto, 0));
  const dias = (f: string) => Math.round((Date.parse(hoy) - Date.parse(f)) / 86_400_000);
  const vencidas = pendientes.filter((p) => p.fecha < hoy);
  const antiguedad = [
    vencidas.filter((p) => dias(p.fecha) <= 30).length,
    vencidas.filter((p) => dias(p.fecha) > 30 && dias(p.fecha) <= 60).length,
    vencidas.filter((p) => dias(p.fecha) > 60 && dias(p.fecha) <= 90).length,
    vencidas.filter((p) => dias(p.fecha) > 90).length,
  ];
  return { cobrado, porCobrar, antiguedad, cuotasPendientes: pendientes.length, cuotasVencidas: vencidas.length, mesActual: meses[5] };
}

/** Comprobantes por aprobar con el tipo de archivo (para la vista previa). */
export async function comprobantesPorAprobar(tx: Ejecutor, limite = 6) {
  return tx
    .select({
      id: pagos.id,
      planId: pagos.planId,
      montoBobCentavos: pagos.montoBobCentavos,
      creadoEn: pagos.creadoEn,
      archivoId: pagos.comprobanteArchivoId,
      mime: archivos.tipoMime,
      cliente: clientes.nombre,
      numero: cuotas.numero,
      plan: planesPago.titulo,
    })
    .from(pagos)
    .innerJoin(cuotas, eq(cuotas.id, pagos.cuotaId))
    .innerJoin(planesPago, eq(planesPago.id, pagos.planId))
    .innerJoin(clientes, eq(clientes.id, planesPago.clienteId))
    .leftJoin(archivos, eq(archivos.id, pagos.comprobanteArchivoId))
    .where(eq(pagos.estado, "pendiente"))
    .orderBy(asc(pagos.creadoEn))
    .limit(limite);
}
