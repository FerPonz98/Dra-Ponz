import "server-only";
import { cache } from "react";
import { organizaciones } from "@/core/db/schema";
import { temaGuardado } from "@/core/tema/servicio";
import { withOrg } from "@/lib/db";
import { contenidoLanding, organizacionDeLanding, type Idioma } from "./landing";

type Org = NonNullable<Awaited<ReturnType<typeof organizacionDeLanding>>>;
const g = globalThis as typeof globalThis & { __orgPorDominio?: Map<string, { org: Org | null; hasta: number }> };
const porDominio = (g.__orgPorDominio ??= new Map());

/**
 * Organización dueña del dominio: en memoria 60 s por proceso (cambia casi nunca; una suspensión o un dominio
 * nuevo tarda como mucho eso en verse). Ahorra una consulta en cada visita a la landing.
 */
export async function organizacionDeLandingCacheada(host: string | null): Promise<Org | null> {
  const dominio = (host ?? "").toLowerCase().replace(/:\d+$/, "").replace(/^www\./, "").slice(0, 253);
  const e = porDominio.get(dominio);
  if (e && e.hasta > Date.now()) return e.org;
  const org = await organizacionDeLanding(dominio);
  if (porDominio.size > 1000) porDominio.clear();
  porDominio.set(dominio, { org, hasta: Date.now() + 60_000 });
  return org;
}

/**
 * Textos y tema de la landing en UNA transacción (siempre frescos, en cualquier proceso de PM2), deduplicados
 * dentro de la petición: generateMetadata y la página los piden ambos.
 */
export const datosLanding = cache((organizacionId: string, idioma: Idioma) =>
  withOrg(organizacionId, async (tx) => {
    // Marca (logo/isotipo subidos) leída fresca: RLS deja ver solo la propia organización.
    const [o] = await tx.select({ id: organizaciones.id, slug: organizaciones.slug, nombre: organizaciones.nombre, logoArchivoId: organizaciones.logoArchivoId, isotipoArchivoId: organizaciones.isotipoArchivoId, fotoLandingArchivoId: organizaciones.fotoLandingArchivoId }).from(organizaciones);
    return { contenido: await contenidoLanding(tx, idioma), tema: await temaGuardado(tx), marca: o };
  }),
);
