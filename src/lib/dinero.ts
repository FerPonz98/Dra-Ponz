// Dinero en centavos enteros para evitar errores de punto flotante.
export type CodigoMoneda = "BOB" | "BRL";

const SIMBOLO: Record<CodigoMoneda, string> = { BOB: "Bs", BRL: "R$" };

export function simboloMoneda(m: CodigoMoneda) {
  return SIMBOLO[m];
}

export function formatoMoneda(centavos: number, moneda: CodigoMoneda = "BOB"): string {
  const signo = centavos < 0 ? "-" : "";
  const abs = Math.abs(Math.round(centavos));
  const entero = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const dec = (abs % 100).toString().padStart(2, "0");
  return `${signo}${SIMBOLO[moneda]} ${entero},${dec}`;
}

/** Acepta "1250", "1250.5", "1.250,50" o "1250,5". Devuelve centavos o null si no es válido. */
export function aCentavos(texto: string | number): number | null {
  if (typeof texto === "number") return Number.isFinite(texto) ? Math.round(texto * 100) : null;
  let t = texto.trim().replace(/\s|Bs|R\$/g, "");
  if (!t) return null;
  if (t.includes(",") && t.includes(".")) t = t.replace(/\./g, "").replace(",", ".");
  else if (t.includes(",")) t = t.replace(",", ".");
  if (!/^-?\d+(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(Number(t) * 100);
}

/** Centavos → texto editable con punto decimal ("1250.50"). */
export function centavosATexto(c: number): string {
  return (c / 100).toFixed(2);
}

/** Porcentaje de un monto en centavos, redondeado al centavo. */
export function porcentajeDe(centavos: number, porcentaje: number): number {
  return Math.round((centavos * porcentaje) / 100);
}
