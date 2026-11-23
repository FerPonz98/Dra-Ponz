import { eq, or } from "drizzle-orm";
import { organizaciones } from "@/core/db/schema";
import { dbAdmin, type Ejecutor } from "@/lib/db";
import { CLAVES_LANDING, CONTENIDO_INICIAL } from "@/modules/tesis/dominio/landing";
import { landingContenido } from "@/modules/tesis/schema";

export type Idioma = "es" | "pt";

/** Organización dueña de la landing: por dominio (con o sin www) o, si no coincide, por LANDING_ORG_SLUG. */
export async function organizacionDeLanding(host: string | null) {
  const dominio = (host ?? "").toLowerCase().replace(/:\d+$/, "").replace(/^www\./, "");
  const slug = process.env.LANDING_ORG_SLUG ?? "dra-ponz";
  const filas = await dbAdmin()
    .select()
    .from(organizaciones)
    .where(or(eq(organizaciones.dominio, dominio), eq(organizaciones.slug, slug)));
  const org = filas.find((o) => o.dominio === dominio) ?? filas.find((o) => o.slug === slug);
  return org && !org.suspendida ? org : null;
}

/** Contenido del idioma; si una clave no está guardada, usa el texto inicial. */
export async function contenidoLanding(tx: Ejecutor, idioma: Idioma): Promise<Record<string, string>> {
  const filas = await tx.select().from(landingContenido).where(eq(landingContenido.idioma, idioma));
  const base = { ...CONTENIDO_INICIAL[idioma] };
  for (const f of filas) base[f.clave] = f.valor;
  return base;
}

export async function guardarContenidoLanding(tx: Ejecutor, organizacionId: string, idioma: Idioma, valores: Record<string, string>) {
  for (const [clave, valor] of Object.entries(valores)) {
    if (!CLAVES_LANDING.includes(clave)) throw new Error(`Clave desconocida: ${clave}`);
    if (valor.length > 5000) throw new Error("Texto demasiado largo (máx. 5000 caracteres por campo)");
    await tx
      .insert(landingContenido)
      .values({ organizacionId, idioma, clave, valor })
      .onConflictDoUpdate({ target: [landingContenido.organizacionId, landingContenido.idioma, landingContenido.clave], set: { valor, actualizadoEn: new Date() } });
  }
}

/** Seed: carga los textos iniciales (ES y PT) sin pisar lo ya editado. */
export async function sembrarLanding(tx: Ejecutor, organizacionId: string) {
  for (const idioma of ["es", "pt"] as const) {
    const valores = Object.entries(CONTENIDO_INICIAL[idioma]).map(([clave, valor]) => ({ organizacionId, idioma, clave, valor }));
    await tx.insert(landingContenido).values(valores).onConflictDoNothing();
  }
}
