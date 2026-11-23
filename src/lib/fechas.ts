// Fechas de negocio como texto "YYYY-MM-DD" (sin hora), calculadas en la zona de la organización.
export const ZONA_DEFECTO = "America/La_Paz";

export function hoyEnZona(zona = ZONA_DEFECTO, ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: zona, year: "numeric", month: "2-digit", day: "2-digit" }).format(ahora);
}

const aUTC = (f: string) => {
  const [a, m, d] = f.split("-").map(Number);
  return Date.UTC(a, m - 1, d);
};
const deUTC = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function sumarDias(fecha: string, dias: number): string {
  return deUTC(aUTC(fecha) + dias * 86_400_000);
}

/** Días de `desde` a `hasta` (positivo si hasta es posterior). */
export function diasEntre(desde: string, hasta: string): number {
  return Math.round((aUTC(hasta) - aUTC(desde)) / 86_400_000);
}

/** Suma meses conservando el día; si el mes no lo tiene, usa el último día del mes. */
export function sumarMeses(fecha: string, meses: number): string {
  const [a, m, d] = fecha.split("-").map(Number);
  const objetivo = new Date(Date.UTC(a, m - 1 + meses, 1));
  const ultimo = new Date(Date.UTC(objetivo.getUTCFullYear(), objetivo.getUTCMonth() + 1, 0)).getUTCDate();
  objetivo.setUTCDate(Math.min(d, ultimo));
  return deUTC(objetivo.getTime());
}

export function esFechaValida(f: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) return false;
  return deUTC(aUTC(f)) === f;
}

export function formatoFecha(f: string | Date | null | undefined, idioma = "es-BO"): string {
  if (!f) return "—";
  if (typeof f === "string") {
    const [a, m, d] = f.slice(0, 10).split("-");
    return `${d}/${m}/${a}`;
  }
  return new Intl.DateTimeFormat(idioma, { timeZone: ZONA_DEFECTO, dateStyle: "short", timeStyle: "short" }).format(f);
}

/** Convierte un instante a fecha local de la zona. */
export function fechaLocal(instante: Date, zona = ZONA_DEFECTO): string {
  return hoyEnZona(zona, instante);
}
