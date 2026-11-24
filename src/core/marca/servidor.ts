import "server-only";
import { eq } from "drizzle-orm";
import { leerArchivo } from "@/core/archivos";
import { archivos, organizaciones } from "@/core/db/schema";
import { temaGuardado } from "@/core/tema/servicio";
import { derivarColores, TEMA_POR_DEFECTO } from "@/core/tema/tema";
import { withOrg } from "@/lib/db";
import { MARCAS_INCORPORADAS, urlMarca } from "./marca";

/** Marca lista para el PDF: el monograma vectorial, un PNG/JPG subido, o solo el nombre (los SVG subidos no se incrustan en PDF). */
export type MarcaPdf = { nombre: string; primario: string; acento: string; titulos: string } & ({ tipo: "jp" } | { tipo: "imagen"; datos: Buffer; formato: "png" | "jpg" } | { tipo: "texto" });

export async function marcaParaPdf(organizacionId: string): Promise<MarcaPdf> {
  return withOrg(organizacionId, async (tx) => {
    const [o] = await tx.select().from(organizaciones).where(eq(organizaciones.id, organizacionId));
    const c = derivarColores((await temaGuardado(tx)) ?? TEMA_POR_DEFECTO);
    const base = { nombre: o.nombre, primario: c.primario, acento: c.acento, titulos: c.primarioTexto };
    const id = o.logoArchivoId ?? o.isotipoArchivoId;
    if (id) {
      const [a] = await tx.select().from(archivos).where(eq(archivos.id, id));
      const formato = a?.tipoMime === "image/png" ? "png" : a?.tipoMime === "image/jpeg" ? "jpg" : null;
      const datos = a && formato ? await leerArchivo(a.rutaRelativa).catch(() => null) : null;
      if (datos && formato) return { ...base, tipo: "imagen", datos, formato };
      return { ...base, tipo: "texto" };
    }
    return MARCAS_INCORPORADAS[o.slug] ? { ...base, tipo: "jp" } : { ...base, tipo: "texto" };
  });
}

/**
 * URL absoluta del logo para correos (PNG: muchos clientes de correo no muestran SVG). La marca incorporada usa el PNG
 * generado (public/brand/logo-correo.png); un logo subido en PNG/JPG se enlaza desde /marca; un SVG subido, sin imagen.
 */
export async function logoParaCorreo(organizacionId: string): Promise<{ url: string; alt: string } | null> {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return withOrg(organizacionId, async (tx) => {
    const [o] = await tx.select().from(organizaciones).where(eq(organizaciones.id, organizacionId));
    if (!o) return null;
    if (o.logoArchivoId || o.isotipoArchivoId) {
      const cual = o.logoArchivoId ? "logo" : "isotipo";
      const [a] = await tx.select({ mime: archivos.tipoMime }).from(archivos).where(eq(archivos.id, (o.logoArchivoId ?? o.isotipoArchivoId)!));
      return a && a.mime !== "image/svg+xml" ? { url: `${base}${urlMarca(o.id, cual)}`, alt: o.nombre } : null;
    }
    return MARCAS_INCORPORADAS[o.slug] ? { url: `${base}/brand/logo-correo.png`, alt: o.nombre } : null;
  });
}
