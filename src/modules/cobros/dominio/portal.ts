import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

export const MAX_INTENTOS = 5;
export const MINUTOS_BLOQUEO = 15;

/** Token del enlace: 32 bytes aleatorios en base64url (43 caracteres, 256 bits). */
export function generarToken(): string {
  return randomBytes(32).toString("base64url");
}

export function generarPin(digitos = 6): string {
  return Array.from({ length: digitos }, () => randomInt(0, 10)).join("");
}

function secreto() {
  const s = process.env.BETTER_AUTH_SECRET;
  if (!s) throw new Error("Falta BETTER_AUTH_SECRET");
  return s;
}

export function hashPin(pin: string): string {
  return createHmac("sha256", secreto()).update(`pin:${pin}`).digest("hex");
}

export function normalizarCi(ci: string): string {
  return ci.replace(/[\s.\-]/g, "").toUpperCase();
}

function igualSeguro(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export type EstadoBloqueo = { intentosFallidos: number; bloqueadoHasta: Date | null };

export function estaBloqueado(e: EstadoBloqueo, ahora: Date): boolean {
  return !!e.bloqueadoHasta && e.bloqueadoHasta > ahora;
}

/** Aplica un intento: si falla 5 veces seguidas, bloquea 15 minutos. Un acierto reinicia el contador. */
export function aplicarIntento(e: EstadoBloqueo, exito: boolean, ahora: Date): EstadoBloqueo {
  if (exito) return { intentosFallidos: 0, bloqueadoHasta: null };
  const vencido = e.bloqueadoHasta && e.bloqueadoHasta <= ahora;
  const intentos = (vencido ? 0 : e.intentosFallidos) + 1;
  if (intentos >= MAX_INTENTOS) return { intentosFallidos: 0, bloqueadoHasta: new Date(ahora.getTime() + MINUTOS_BLOQUEO * 60_000) };
  return { intentosFallidos: intentos, bloqueadoHasta: null };
}

export function verificarCredencial(enlace: { metodo: "ci" | "pin"; ci: string | null; pinHash: string | null }, valor: string): boolean {
  const v = valor.trim();
  if (!v || v.length > 30) return false;
  if (enlace.metodo === "pin") return /^\d{4,6}$/.test(v) && !!enlace.pinHash && igualSeguro(hashPin(v), enlace.pinHash);
  return !!enlace.ci && igualSeguro(normalizarCi(v), normalizarCi(enlace.ci));
}

// ── Cookie de sesión del portal: "<enlaceId>.<expira>.<firma>" ──
export const HORAS_SESION_PORTAL = 2;
export const nombreCookiePortal = (enlaceId: string) => `portal_${enlaceId.replace(/-/g, "")}`;

export function firmarSesionPortal(enlaceId: string, ahora = new Date()): string {
  const exp = ahora.getTime() + HORAS_SESION_PORTAL * 3_600_000;
  const firma = createHmac("sha256", secreto()).update(`portal:${enlaceId}:${exp}`).digest("base64url");
  return `${enlaceId}.${exp}.${firma}`;
}

export function verificarSesionPortal(valor: string | undefined, enlaceId: string, ahora = new Date()): boolean {
  if (!valor) return false;
  const [id, exp, firma] = valor.split(".");
  if (id !== enlaceId || !exp || !firma || Number(exp) < ahora.getTime()) return false;
  const esperada = createHmac("sha256", secreto()).update(`portal:${enlaceId}:${exp}`).digest("base64url");
  return igualSeguro(firma, esperada);
}
