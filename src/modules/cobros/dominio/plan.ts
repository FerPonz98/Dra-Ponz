import { z } from "zod";
import { centavosATexto } from "@/lib/dinero";
import { esFechaValida, sumarMeses } from "@/lib/fechas";

export type CuotaEditable = { id?: string; numero?: number; concepto?: string | null; montoCentavos: number; fechaVencimiento: string; estado?: "pendiente" | "pagada" };

export const esquemaCuota = z.object({
  id: z.uuid().optional(),
  concepto: z.string().trim().max(120).nullish(),
  montoCentavos: z.number().int().positive("El monto debe ser mayor a 0").max(2_000_000_000),
  fechaVencimiento: z.string().refine(esFechaValida, "Fecha inválida"),
});

export const esquemaReglasMora = z.object({
  plazoPrimeraCuotaDias: z.number().int().min(0).max(365).nullable(),
  diasGracia: z.number().int().min(0).max(30).nullable(),
  recargoActivo: z.boolean(),
  recargoPorcentaje: z.number().min(0).max(100).nullable(),
  recargoModo: z.enum(["unico", "mensual"]),
  diasGraciaNuevaMora: z.number().int().min(0).max(90).nullable(),
});
export type ReglasMora = z.infer<typeof esquemaReglasMora>;

export const REGLAS_VACIAS: ReglasMora = {
  plazoPrimeraCuotaDias: null,
  diasGracia: null,
  recargoActivo: false,
  recargoPorcentaje: null,
  recargoModo: "unico",
  diasGraciaNuevaMora: null,
};

export function calcularTotal(cuotas: Pick<CuotaEditable, "montoCentavos">[]): number {
  return cuotas.reduce((s, c) => s + c.montoCentavos, 0);
}

/** Reparte un total en n cuotas mensuales (el resto de centavos va a la última). */
export function generarCuotas(n: number, totalCentavos: number, primeraFecha: string): CuotaEditable[] {
  if (n < 1 || n > 120) throw new Error("Número de cuotas fuera de rango (1–120)");
  const base = Math.floor(totalCentavos / n);
  return Array.from({ length: n }, (_, i) => ({
    numero: i + 1,
    montoCentavos: i === n - 1 ? totalCentavos - base * (n - 1) : base,
    fechaVencimiento: sumarMeses(primeraFecha, i),
  }));
}

export type CambioHistorial = { cuotaId: string | null; campo: string; valorAntes: string | null; valorDespues: string | null };

export type PlanCambios = {
  crear: (CuotaEditable & { numero: number })[];
  actualizar: { id: string; numero: number; montoCentavos: number; fechaVencimiento: string; concepto: string | null }[];
  eliminar: string[];
  historial: CambioHistorial[];
};

/**
 * Compara las cuotas guardadas con las nuevas y devuelve qué crear/actualizar/eliminar más el historial
 * (valor antes y después). Las fechas se pueden editar siempre; las cuotas pagadas no cambian de monto ni se eliminan.
 */
export function calcularCambiosCuotas(antes: (CuotaEditable & { id: string; numero: number })[], despues: CuotaEditable[]): PlanCambios {
  const res: PlanCambios = { crear: [], actualizar: [], eliminar: [], historial: [] };
  const porId = new Map(antes.map((c) => [c.id, c]));
  const vistos = new Set<string>();
  despues.forEach((c, i) => {
    const numero = i + 1;
    const concepto = c.concepto?.trim() || null;
    if (c.id && porId.has(c.id)) {
      const a = porId.get(c.id)!;
      vistos.add(c.id);
      if (a.estado === "pagada" && a.montoCentavos !== c.montoCentavos) throw new Error(`La cuota ${a.numero} ya está pagada: su monto no se puede cambiar.`);
      const cambios: CambioHistorial[] = [];
      if (a.montoCentavos !== c.montoCentavos)
        cambios.push({ cuotaId: a.id, campo: `cuota ${a.numero} · monto`, valorAntes: centavosATexto(a.montoCentavos), valorDespues: centavosATexto(c.montoCentavos) });
      if (a.fechaVencimiento !== c.fechaVencimiento)
        cambios.push({ cuotaId: a.id, campo: `cuota ${a.numero} · fecha`, valorAntes: a.fechaVencimiento, valorDespues: c.fechaVencimiento });
      if (a.numero !== numero) cambios.push({ cuotaId: a.id, campo: `cuota ${a.numero} · número`, valorAntes: String(a.numero), valorDespues: String(numero) });
      if ((a.concepto ?? null) !== concepto) cambios.push({ cuotaId: a.id, campo: `cuota ${a.numero} · concepto`, valorAntes: a.concepto ?? null, valorDespues: concepto });
      if (cambios.length) {
        res.actualizar.push({ id: a.id, numero, montoCentavos: c.montoCentavos, fechaVencimiento: c.fechaVencimiento, concepto });
        res.historial.push(...cambios);
      }
    } else {
      res.crear.push({ ...c, numero, concepto });
      res.historial.push({ cuotaId: null, campo: "cuota agregada", valorAntes: null, valorDespues: `#${numero} · ${centavosATexto(c.montoCentavos)} · ${c.fechaVencimiento}` });
    }
  });
  for (const a of antes) {
    if (vistos.has(a.id)) continue;
    if (a.estado === "pagada") throw new Error(`La cuota ${a.numero} ya está pagada y no se puede quitar.`);
    res.eliminar.push(a.id);
    res.historial.push({ cuotaId: a.id, campo: "cuota quitada", valorAntes: `#${a.numero} · ${centavosATexto(a.montoCentavos)} · ${a.fechaVencimiento}`, valorDespues: null });
  }
  const totalAntes = calcularTotal(antes);
  const totalDespues = calcularTotal(despues);
  if (totalAntes !== totalDespues) res.historial.push({ cuotaId: null, campo: "total", valorAntes: centavosATexto(totalAntes), valorDespues: centavosATexto(totalDespues) });
  return res;
}

/** Historial de cambios en las reglas de mora. */
export function cambiosReglas(antes: ReglasMora, despues: ReglasMora): CambioHistorial[] {
  const nombres: Record<keyof ReglasMora, string> = {
    plazoPrimeraCuotaDias: "plazo 1.ª cuota (días)",
    diasGracia: "días de gracia",
    recargoActivo: "recargo activo",
    recargoPorcentaje: "recargo %",
    recargoModo: "modo de recargo",
    diasGraciaNuevaMora: "gracia en nueva mora",
  };
  return (Object.keys(nombres) as (keyof ReglasMora)[])
    .filter((k) => String(antes[k] ?? "") !== String(despues[k] ?? ""))
    .map((k) => ({ cuotaId: null, campo: nombres[k], valorAntes: antes[k] === null ? null : String(antes[k]), valorDespues: despues[k] === null ? null : String(despues[k]) }));
}
