import { z } from "zod";

export type Resultado<T = unknown> = { ok: true; mensaje?: string; datos?: T } | { ok: false; mensaje: string };

/** Convierte errores (Zod u otros) en un mensaje listo para mostrar. */
export function mensajeDeError(e: unknown): string {
  if (e instanceof z.ZodError) return e.issues.map((i) => i.message).join(" · ");
  if (e instanceof Error) {
    if (e.message.includes("duplicate key")) return "Ya existe un registro con esos datos.";
    if (/NEXT_(REDIRECT|HTTP_ERROR)/.test(e.message)) throw e;
    return e.message;
  }
  return "Ocurrió un error inesperado.";
}

export async function ejecutar<T>(fn: () => Promise<T>, mensaje?: string): Promise<Resultado<T>> {
  try {
    const datos = await fn();
    return { ok: true, mensaje, datos };
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e && typeof (e as { digest: unknown }).digest === "string" && /NEXT_/.test((e as { digest: string }).digest)) throw e;
    return { ok: false, mensaje: mensajeDeError(e) };
  }
}
