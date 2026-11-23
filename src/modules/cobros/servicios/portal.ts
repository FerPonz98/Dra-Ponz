import type { Ejecutor } from "@/lib/db";
import { evaluarMora } from "@/modules/cobros/dominio/mora";
import { montoAPagar } from "./pagos";
import { obtenerPlanCompleto } from "./planes";

/** Datos que ve el cliente en su portal: cuotas con su situación, próxima cuota a pagar y su monto en Bs. */
export async function datosPortal(tx: Ejecutor, planId: string, hoy: string) {
  const p = await obtenerPlanCompleto(tx, planId);
  if (!p) return null;
  const ev = evaluarMora({ reglas: p.reglas, aceptadoEn: p.plan.aceptadoEn, numeroMoras: p.plan.numeroMoras, estadoMora: p.plan.estadoMora }, p.cuotas.map((c) => ({ ...c, pagoEnRevision: c.pagoPendiente })), hoy);
  const situacion = new Map(ev.cuotas.map((c) => [c.id, c]));
  const proxima = p.cuotas.find((c) => c.estado === "pendiente" && !c.pagoPendiente) ?? null;
  let cobro: Awaited<ReturnType<typeof montoAPagar>> | null = null;
  let errorCobro: string | null = null;
  if (proxima) {
    try {
      cobro = await montoAPagar(tx, proxima.id, hoy);
    } catch (e) {
      errorCobro = e instanceof Error ? e.message : "No se pudo calcular el monto";
    }
  }
  return {
    ...p,
    cuotas: p.cuotas.map((c) => ({ ...c, situacion: situacion.get(c.id)!.situacion, vencimiento: situacion.get(c.id)!.vencimiento })),
    proxima,
    cobro,
    errorCobro,
    // Historial visible para el cliente: sin datos internos de quién editó.
    pagos: p.pagos.map((x) => ({ id: x.id, cuotaId: x.cuotaId, estado: x.estado, montoBobCentavos: x.montoBobCentavos, creadoEn: x.creadoEn, motivoRechazo: x.motivoRechazo, comprobanteArchivoId: x.comprobanteArchivoId })),
  };
}
export type DatosPortal = NonNullable<Awaited<ReturnType<typeof datosPortal>>>;
