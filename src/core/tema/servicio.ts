import { eq } from "drizzle-orm";
import { organizaciones, organizacionTema } from "@/core/db/schema";
import type { Ejecutor } from "@/lib/db";
import { esquemaTema, presetDe, TEMA_POR_DEFECTO, type Tema } from "./tema";

/** Tema guardado de la organización activa (RLS) o null si nunca lo eligió. Usar dentro de withOrg. */
export async function temaGuardado(tx: Ejecutor): Promise<Tema | null> {
  const [f] = await tx.select().from(organizacionTema).limit(1);
  if (!f) return null;
  const r = esquemaTema.safeParse({ ...f, preset: f.preset ?? null });
  // Un tema que ya no pasa la validación (p. ej. reglas más estrictas) se ignora en vez de romper la página.
  return r.success ? r.data : null;
}

export async function obtenerTema(tx: Ejecutor): Promise<Tema> {
  return (await temaGuardado(tx)) ?? TEMA_POR_DEFECTO;
}

/** Valida (formato + contraste AA) y guarda. Lanza ZodError si la combinación es ilegible. */
export async function guardarTema(tx: Ejecutor, organizacionId: string, entrada: unknown): Promise<Tema> {
  const d = esquemaTema.parse(entrada);
  const t: Tema = { ...d, preset: presetDe(d) };
  await tx
    .insert(organizacionTema)
    .values({ organizacionId, ...t })
    .onConflictDoUpdate({ target: organizacionTema.organizacionId, set: { ...t, actualizadoEn: new Date() } });
  // Mantiene sincronizados los colores de marca de la organización (los usan otros lugares, p. ej. el logo del portal).
  await tx.update(organizaciones).set({ colorPrimario: t.colorPrimario, colorSecundario: t.colorSecundario }).where(eq(organizaciones.id, organizacionId));
  return t;
}

/** Seed: tema por defecto (colores actuales de la Dra.) sin pisar uno ya elegido. */
export async function sembrarTema(tx: Ejecutor, organizacionId: string) {
  await tx.insert(organizacionTema).values({ organizacionId, ...TEMA_POR_DEFECTO }).onConflictDoNothing();
}
