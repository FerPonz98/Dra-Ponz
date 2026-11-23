import { and, eq, inArray } from "drizzle-orm";
import type { Ejecutor } from "@/lib/db";
import { diasEntre, sumarDias } from "@/lib/fechas";
import { clientes, cuotas, planesPago } from "@/modules/cobros/schema";
import { rangoMes } from "@/modules/tesis/dominio/cronograma";
import { actividades, cronogramas, propuestas } from "@/modules/tesis/schema";

export type SituacionCobro = "al_dia" | "por_vencer" | "en_gracia" | "en_cola" | "pagada";
export const COLOR_SITUACION: Record<SituacionCobro | "actividad" | "actividad_hecha", string> = {
  al_dia: "#15803d",
  por_vencer: "#b45309",
  en_gracia: "#c2410c",
  en_cola: "#b91c1c",
  pagada: "#78716c",
  actividad: "#4338ca",
  actividad_hecha: "#818cf8",
};
export const ETIQUETA_SITUACION: Record<SituacionCobro, string> = {
  al_dia: "Al día",
  por_vencer: "Por vencer (3 días)",
  en_gracia: "En gracia",
  en_cola: "En cola",
  pagada: "Pagada",
};

export function situacionCuota(c: { estado: string; fechaVencimiento: string }, estadoMora: string, hoy: string): SituacionCobro {
  if (c.estado === "pagada") return "pagada";
  const dias = diasEntre(hoy, c.fechaVencimiento);
  if (dias < 0) return estadoMora === "en_cola" ? "en_cola" : "en_gracia";
  if (dias <= 3) return "por_vencer";
  return estadoMora === "en_cola" ? "en_cola" : "al_dia";
}

export type EventoCalendario = { id: string; title: string; start: string; end?: string; allDay: true; color: string; url: string; extendedProps: { tipo: "actividad" | "cobro"; situacion?: SituacionCobro; color: string } };

/** Eventos del calendario: actividades de los cronogramas vigentes y cuotas de los proyectos de tesis. */
export async function eventosCalendario(tx: Ejecutor, hoy: string): Promise<EventoCalendario[]> {
  const props = await tx
    .select({ p: propuestas, cliente: clientes.nombre, estadoMora: planesPago.estadoMora })
    .from(propuestas)
    .innerJoin(clientes, eq(clientes.id, propuestas.clienteId))
    .innerJoin(planesPago, eq(planesPago.id, propuestas.planId))
    .where(inArray(propuestas.estado, ["enviada", "aceptada", "en_curso", "en_gracia", "en_cola", "tribunal"]));
  if (!props.length) return [];
  const ids = props.map((x) => x.p.id);
  const crs = await tx.select().from(cronogramas).where(and(inArray(cronogramas.propuestaId, ids), eq(cronogramas.estado, "aceptado")));
  const acts = crs.length ? await tx.select().from(actividades).where(inArray(actividades.cronogramaId, crs.map((c) => c.id))) : [];
  const cs = await tx.select().from(cuotas).where(inArray(cuotas.planId, props.map((x) => x.p.planId)));
  const eventos: EventoCalendario[] = [];
  for (const { p, cliente, estadoMora } of props) {
    const url = `/panel/tesis/propuestas/${p.id}`;
    const cr = crs.find((c) => c.propuestaId === p.id);
    if (cr) {
      for (const a of acts.filter((x) => x.cronogramaId === cr.id)) {
        for (const m of a.meses) {
          const r = rangoMes(cr.fechaInicio, m);
          eventos.push({
            id: `a-${a.id}-${m}`,
            title: `${cliente.split(" ")[0]}: ${a.nombre}`,
            start: r.desde,
            end: sumarDias(r.hasta, 1),
            allDay: true,
            color: a.hecha ? COLOR_SITUACION.actividad_hecha : COLOR_SITUACION.actividad,
            url,
            extendedProps: { tipo: "actividad", color: a.hecha ? COLOR_SITUACION.actividad_hecha : COLOR_SITUACION.actividad },
          });
        }
      }
    }
    for (const c of cs.filter((x) => x.planId === p.planId)) {
      const s = situacionCuota(c, estadoMora, hoy);
      eventos.push({
        id: `c-${c.id}`,
        title: `Cobro ${cliente.split(" ")[0]} · cuota ${c.numero}`,
        start: c.fechaVencimiento,
        allDay: true,
        color: COLOR_SITUACION[s],
        url,
        extendedProps: { tipo: "cobro", situacion: s, color: COLOR_SITUACION[s] },
      });
    }
  }
  return eventos;
}
