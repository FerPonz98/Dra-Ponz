import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { guardarArchivo, type TipoArchivo } from "@/core/archivos";
import { archivos } from "@/core/db/schema";
import type { Ejecutor } from "@/lib/db";
import { convertirABob } from "@/modules/cobros/dominio/tipo-cambio";
import { clientes, cuotas, pagos, planesPago, recargos } from "@/modules/cobros/schema";
import { recalcularMora, type Actor } from "./planes";
import { cotizacionBrl } from "./tipo-cambio";

export const TIPOS_COMPROBANTE: TipoArchivo[] = ["imagen", "pdf"];

/** Monto a pagar de una cuota (monto + recargos) y su equivalente en Bs con la cotización del día. */
export async function montoAPagar(tx: Ejecutor, cuotaId: string, hoy: string) {
  const [fila] = await tx.select({ cuota: cuotas, moneda: planesPago.moneda }).from(cuotas).innerJoin(planesPago, eq(planesPago.id, cuotas.planId)).where(eq(cuotas.id, cuotaId));
  if (!fila) throw new Error("Cuota no encontrada");
  const [{ rec }] = await tx.select({ rec: sql<number>`coalesce(sum(${recargos.montoCentavos}),0)::int` }).from(recargos).where(eq(recargos.cuotaId, cuotaId));
  const monto = fila.cuota.montoCentavos + rec;
  if (fila.moneda === "BOB") return { cuota: fila.cuota, moneda: fila.moneda, montoCentavos: monto, montoBobCentavos: monto, tipoCambio: null, tipoCambioFecha: null, esRespaldo: false };
  const { cotizacion, esRespaldo } = await cotizacionBrl(tx, hoy);
  if (!cotizacion) throw new Error("Todavía no hay cotización BRL→BOB registrada. Intenta más tarde.");
  return {
    cuota: fila.cuota,
    moneda: fila.moneda,
    montoCentavos: monto,
    montoBobCentavos: convertirABob(monto, fila.moneda, cotizacion.valor),
    tipoCambio: cotizacion.valor,
    tipoCambioFecha: cotizacion.fecha,
    esRespaldo,
  };
}

/** El cliente sube el comprobante: se guarda el monto en Bs y el tipo de cambio del día del pago. */
export async function registrarPago(tx: Ejecutor, d: { organizacionId: string; planId: string; cuotaId: string; enlaceId: string | null; archivo: File; hoy: string }) {
  const m = await montoAPagar(tx, d.cuotaId, d.hoy);
  if (m.cuota.planId !== d.planId) throw new Error("La cuota no pertenece a este plan");
  if (m.cuota.estado === "pagada") throw new Error("Esta cuota ya está pagada");
  const [pend] = await tx.select({ id: pagos.id }).from(pagos).where(and(eq(pagos.cuotaId, d.cuotaId), eq(pagos.estado, "pendiente")));
  if (pend) throw new Error("Ya enviaste un comprobante para esta cuota; está en revisión.");
  const archivo = await guardarArchivo(tx, { organizacionId: d.organizacionId, categoria: "comprobantes", archivo: d.archivo, permitidos: TIPOS_COMPROBANTE, enlaceId: d.enlaceId });
  const [p] = await tx
    .insert(pagos)
    .values({
      organizacionId: d.organizacionId,
      planId: d.planId,
      cuotaId: d.cuotaId,
      enlaceId: d.enlaceId,
      moneda: m.moneda,
      montoCentavos: m.montoCentavos,
      tipoCambio: m.tipoCambio === null ? null : m.tipoCambio.toFixed(5),
      tipoCambioFecha: m.tipoCambioFecha,
      montoBobCentavos: m.montoBobCentavos,
      comprobanteArchivoId: archivo.id,
    })
    .returning();
  return p;
}

export async function aprobarPago(tx: Ejecutor, actor: Actor, pagoId: string, hoy: string, zona?: string) {
  const [p] = await tx.select().from(pagos).where(eq(pagos.id, pagoId)).for("update");
  if (!p) throw new Error("Pago no encontrado");
  if (p.estado !== "pendiente") throw new Error("Este pago ya fue revisado");
  await tx.update(pagos).set({ estado: "aprobado", revisadoPor: actor.usuarioNombre, revisadoEn: new Date() }).where(eq(pagos.id, pagoId));
  await tx.update(cuotas).set({ estado: "pagada", pagadaEn: new Date() }).where(eq(cuotas.id, p.cuotaId));
  const mora = await recalcularMora(tx, p.planId, hoy, zona);
  return { pago: p, mora };
}

export async function rechazarPago(tx: Ejecutor, actor: Actor, pagoId: string, motivo: string) {
  const m = motivo.trim();
  if (m.length < 3) throw new Error("Escribe el motivo del rechazo");
  const [p] = await tx.select().from(pagos).where(eq(pagos.id, pagoId)).for("update");
  if (!p) throw new Error("Pago no encontrado");
  if (p.estado !== "pendiente") throw new Error("Este pago ya fue revisado");
  await tx.update(pagos).set({ estado: "rechazado", motivoRechazo: m.slice(0, 500), revisadoPor: actor.usuarioNombre, revisadoEn: new Date() }).where(eq(pagos.id, pagoId));
  return p;
}

export async function listarPagos(tx: Ejecutor, estado: "pendiente" | "aprobado" | "rechazado" = "pendiente") {
  return tx
    .select({ pago: pagos, cuota: { numero: cuotas.numero, fecha: cuotas.fechaVencimiento }, plan: { id: planesPago.id, titulo: planesPago.titulo }, cliente: { nombre: clientes.nombre, whatsapp: clientes.whatsapp } })
    .from(pagos)
    .innerJoin(cuotas, eq(cuotas.id, pagos.cuotaId))
    .innerJoin(planesPago, eq(planesPago.id, pagos.planId))
    .innerJoin(clientes, eq(clientes.id, planesPago.clienteId))
    .where(eq(pagos.estado, estado))
    .orderBy(desc(pagos.creadoEn))
    .limit(200);
}

/** Archivos que un enlace del portal puede descargar (los suyos). */
export async function archivoDeEnlace(tx: Ejecutor, archivoId: string, enlaceIds: string[]) {
  if (!enlaceIds.length) return null;
  const [a] = await tx.select().from(archivos).where(and(eq(archivos.id, archivoId), inArray(archivos.enlaceId, enlaceIds)));
  return a ?? null;
}
