import "server-only";
import type { ContextoOrg } from "@/core/contexto";
import type { Ejecutor } from "@/lib/db";
import type { ClavePlantilla } from "@/modules/cobros/dominio/mensajes";
import { mensaje, vars } from "@/modules/cobros/servicios/mensajes";
import type { PlanCompleto } from "@/modules/cobros/servicios/planes";

/** Elige la plantilla según la situación del plan y la rellena. */
export async function mensajeParaPlan(tx: Ejecutor, ctx: ContextoOrg, p: PlanCompleto, enlace: string | null, hoy: string) {
  void ctx;
  const proxima = p.cuotas.find((c) => c.estado === "pendiente");
  let clave: ClavePlantilla = "recordatorio";
  if (p.plan.estadoMora === "en_cola") clave = "en_cola";
  else if (p.plan.estadoMora === "vencida") clave = "cuota_vencida";
  else if (!p.pagos.length && !p.cuotas.some((c) => c.estado === "pagada")) clave = "enviar_plan";
  else if (!proxima) clave = "pago_aprobado";
  const cuota = clave === "pago_aprobado" ? p.cuotas.filter((c) => c.estado === "pagada").at(-1) : (p.cuotas.find((c) => c.estado === "pendiente" && c.fechaVencimiento <= hoy) ?? proxima);
  return mensaje(tx, clave, vars({ nombre: p.cliente.nombre, montoCentavos: cuota?.aPagarCentavos, moneda: p.plan.moneda, fecha: cuota?.fechaVencimiento, enlace, proyecto: p.plan.titulo }));
}
