import type { EstadoMora } from "@/modules/cobros/schema";
import { porcentajeDe } from "@/lib/dinero";
import { diasEntre, fechaLocal, sumarDias } from "@/lib/fechas";
import type { ReglasMora } from "./plan";

export const DIAS_POR_MES_RECARGO = 30;

export type CuotaMora = {
  id: string;
  numero: number;
  montoCentavos: number;
  fechaVencimiento: string;
  estado: "pendiente" | "pagada";
  /** Hay un comprobante esperando revisión: no se escala ni se recarga mientras tanto. */
  pagoEnRevision?: boolean;
};

export type PlanMora = {
  reglas: ReglasMora;
  aceptadoEn: Date | string | null;
  numeroMoras: number;
  estadoMora: EstadoMora;
  zona?: string;
};

export type RecargoEsperado = { cuotaId: string; numero: number; porcentaje: number; montoCentavos: number; aplicadoEn: string };

export type ResultadoMora = {
  estadoMora: EstadoMora;
  numeroMoras: number;
  diasGraciaAplicados: number;
  recargos: RecargoEsperado[];
  cuotas: { id: string; vencimiento: string; diasAtraso: number; situacion: "pagada" | "al_dia" | "vencida" | "en_cola" | "en_revision" }[];
};

/** Fecha efectiva de vencimiento: la 1.ª cuota vence a los X días de aceptar si el plan define ese plazo. */
export function vencimientoEfectivo(c: Pick<CuotaMora, "numero" | "fechaVencimiento">, plan: PlanMora): { fecha: string; esPlazoPrimera: boolean } {
  if (c.numero === 1 && plan.reglas.plazoPrimeraCuotaDias !== null && plan.aceptadoEn) {
    const aceptado = typeof plan.aceptadoEn === "string" ? plan.aceptadoEn.slice(0, 10) : fechaLocal(plan.aceptadoEn, plan.zona);
    return { fecha: sumarDias(aceptado, plan.reglas.plazoPrimeraCuotaDias), esPlazoPrimera: true };
  }
  return { fecha: c.fechaVencimiento, esPlazoPrimera: false };
}

/**
 * Evalúa el estado de mora de un plan para el día `hoy`.
 * - al_dia: ninguna cuota impaga vencida.
 * - vencida: hay cuotas vencidas, todas dentro de la gracia.
 * - en_cola: alguna cuota superó la gracia → plan pausado y recargo aplicado (si está activo).
 * La 1.ª mora usa `diasGracia`; las siguientes, `diasGraciaNuevaMora` (si se definió).
 * Es pura: el job compara los recargos esperados con los ya guardados (idempotente).
 */
export function evaluarMora(plan: PlanMora, cuotas: CuotaMora[], hoy: string): ResultadoMora {
  const r = plan.reglas;
  const detalle = cuotas.map((c) => {
    const v = vencimientoEfectivo(c, plan);
    return { c, venc: v.fecha, esPlazoPrimera: v.esPlazoPrimera, atraso: diasEntre(v.fecha, hoy) };
  });
  const vencidas = detalle.filter((d) => d.c.estado === "pendiente" && !d.c.pagoEnRevision && d.atraso > 0);

  let numeroMoras = plan.numeroMoras;
  if (vencidas.length > 0 && plan.estadoMora === "al_dia") numeroMoras += 1; // empieza una mora nueva
  const gracia = numeroMoras > 1 && r.diasGraciaNuevaMora !== null ? r.diasGraciaNuevaMora : (r.diasGracia ?? 0);
  const graciaDe = (d: (typeof detalle)[number]) => (d.esPlazoPrimera ? 0 : gracia);

  const enCola = vencidas.some((d) => d.atraso > graciaDe(d));
  const estadoMora: EstadoMora = vencidas.length === 0 ? "al_dia" : enCola ? "en_cola" : "vencida";

  const recargos: RecargoEsperado[] = [];
  const pct = r.recargoActivo ? (r.recargoPorcentaje ?? 0) : 0;
  if (pct > 0) {
    for (const d of vencidas) {
      const g = graciaDe(d);
      if (d.atraso <= g) continue;
      const inicio = sumarDias(d.venc, g + 1);
      const n = r.recargoModo === "mensual" ? Math.floor((d.atraso - g - 1) / DIAS_POR_MES_RECARGO) + 1 : 1;
      for (let k = 1; k <= n; k++) {
        recargos.push({
          cuotaId: d.c.id,
          numero: k,
          porcentaje: pct,
          montoCentavos: porcentajeDe(d.c.montoCentavos, pct),
          aplicadoEn: sumarDias(inicio, (k - 1) * DIAS_POR_MES_RECARGO),
        });
      }
    }
  }

  return {
    estadoMora,
    numeroMoras: estadoMora === "al_dia" ? plan.numeroMoras : numeroMoras,
    diasGraciaAplicados: gracia,
    recargos,
    cuotas: detalle.map((d) => ({
      id: d.c.id,
      vencimiento: d.venc,
      diasAtraso: Math.max(0, d.atraso),
      situacion:
        d.c.estado === "pagada"
          ? "pagada"
          : d.c.pagoEnRevision
            ? "en_revision"
            : d.atraso <= 0
              ? "al_dia"
              : d.atraso > graciaDe(d)
                ? "en_cola"
                : "vencida",
    })),
  };
}

/** Recargos que faltan guardar (los existentes se identifican por cuota + número). */
export function recargosNuevos(esperados: RecargoEsperado[], existentes: { cuotaId: string; numero: number }[]): RecargoEsperado[] {
  const ya = new Set(existentes.map((e) => `${e.cuotaId}:${e.numero}`));
  return esperados.filter((e) => !ya.has(`${e.cuotaId}:${e.numero}`));
}
