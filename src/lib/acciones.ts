import { z } from "zod";
import { DemasiadasPeticiones, OrigenNoPermitido } from "./seguridad";

export type Resultado<T = unknown> = { ok: true; mensaje?: string; datos?: T } | { ok: false; mensaje: string };

const GENERICO = "Ocurrió un error inesperado. Inténtalo de nuevo.";

/** Error de la base de datos o del driver (sus mensajes tienen detalles internos: tablas, SQL, valores). */
function esErrorInterno(e: Error): boolean {
  const causa = (e as { cause?: unknown }).cause;
  return (
    "code" in e ||
    /^Failed query|relation "|column "|syntax|violates|constraint|ECONN|ETIMEDOUT|invalid input/i.test(e.message) ||
    (causa instanceof Error && "code" in causa)
  );
}

/** Convierte errores (Zod u otros) en un mensaje listo para mostrar, sin filtrar detalles internos. */
export function mensajeDeError(e: unknown): string {
  if (e instanceof z.ZodError) return e.issues.map((i) => i.message).join(" · ");
  if (e instanceof Error) {
    if (/NEXT_(REDIRECT|HTTP_ERROR)/.test(e.message)) throw e;
    const texto = `${e.message} ${(e as { cause?: Error }).cause?.message ?? ""}`;
    if (texto.includes("duplicate key")) return "Ya existe un registro con esos datos.";
    if (esErrorInterno(e)) {
      console.error("[error interno]", e);
      return GENERICO;
    }
    return e.message;
  }
  return GENERICO;
}

/** Código HTTP para errores de rutas propias. */
export function estadoDeError(e: unknown): number {
  if (e instanceof DemasiadasPeticiones) return 429;
  if (e instanceof OrigenNoPermitido) return 403;
  return 400;
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
