// Utilidades de color puras (sin dependencias): HEX ⇄ RGB, mezcla, luminancia y contraste WCAG 2.x.

export type Rgb = [number, number, number];

export const HEX = /^#[0-9a-fA-F]{6}$/;

export function normalizarHex(v: string): string | null {
  const s = v.trim().replace(/^#?/, "#");
  if (/^#[0-9a-fA-F]{3}$/.test(s)) return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`.toLowerCase();
  return HEX.test(s) ? s.toLowerCase() : null;
}

export function hexARgb(hex: string): Rgb {
  const h = normalizarHex(hex);
  if (!h) throw new Error(`Color inválido: ${hex}`);
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

export function rgbAHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((x) => Math.round(Math.min(255, Math.max(0, x))).toString(16).padStart(2, "0")).join("")}`;
}

/** Mezcla `a` con `b`; `peso` es la proporción de `a` (1 = solo a). */
export function mezclar(a: string, b: string, peso: number): string {
  const x = hexARgb(a);
  const y = hexARgb(b);
  return rgbAHex([0, 1, 2].map((i) => x[i] * peso + y[i] * (1 - peso)) as Rgb);
}

export function luminancia(hex: string): number {
  const [r, g, b] = hexARgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Relación de contraste WCAG (1 a 21). */
export function contraste(a: string, b: string): number {
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

export const esClaro = (hex: string) => luminancia(hex) > 0.4;

/**
 * Devuelve el color más parecido a `color` que alcanza `minimo` de contraste contra TODOS los `fondos`.
 * Oscurece si los fondos son claros y aclara si son oscuros. Si ya cumple, lo devuelve tal cual.
 */
export function ajustarContraste(color: string, fondos: string[], minimo: number): string {
  const cumple = (c: string) => fondos.every((f) => contraste(c, f) >= minimo);
  if (cumple(color)) return normalizarHex(color)!;
  const promedioClaro = fondos.reduce((s, f) => s + luminancia(f), 0) / fondos.length > 0.18;
  const destino = promedioClaro ? "#000000" : "#ffffff";
  for (let i = 1; i <= 100; i++) {
    const c = mezclar(destino, color, i / 100);
    if (cumple(c)) return c;
  }
  return destino;
}

/** De una lista de candidatos, el primero que cumple `minimo` contra `fondo`; si ninguno, el de mayor contraste. */
export function primeroLegible(fondo: string, candidatos: string[], minimo = 4.5): string {
  const ok = candidatos.find((c) => contraste(c, fondo) >= minimo);
  if (ok) return ok;
  return [...candidatos].sort((a, b) => contraste(b, fondo) - contraste(a, fondo))[0];
}

export const redondear = (n: number) => Math.floor(n * 100) / 100;
