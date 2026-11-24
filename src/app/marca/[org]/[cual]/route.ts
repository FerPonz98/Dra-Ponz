import { eq } from "drizzle-orm";
import { leerArchivo } from "@/core/archivos";
import { archivos, organizaciones } from "@/core/db/schema";
import { dbAdmin } from "@/lib/db";
import { DemasiadasPeticiones, exigirLimite } from "@/lib/seguridad";

/**
 * Logo, isotipo y foto de la landing subidos por una organización (públicos: se ven en la landing, el portal y los correos).
 * Solo sirve archivos de la categoría "marca" asociados a esa organización. Los SVG ya están sanitizados al subirse
 * y además se sirven con CSP sandbox y nosniff (aunque se abran directo, no ejecutan nada).
 */
export async function GET(req: Request, ctx: { params: Promise<{ org: string; cual: string }> }) {
  try {
    exigirLimite(req.headers, "marca", 300);
  } catch (e) {
    if (e instanceof DemasiadasPeticiones) return new Response(e.message, { status: 429, headers: { "Retry-After": "60" } });
    throw e;
  }
  const { org, cual } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(org) || (cual !== "logo" && cual !== "isotipo" && cual !== "foto")) return new Response("No encontrado", { status: 404 });
  const [o] = await dbAdmin().select({ logo: organizaciones.logoArchivoId, isotipo: organizaciones.isotipoArchivoId, foto: organizaciones.fotoLandingArchivoId, suspendida: organizaciones.suspendida }).from(organizaciones).where(eq(organizaciones.id, org));
  const id = o && !o.suspendida ? (cual === "logo" ? o.logo : cual === "isotipo" ? o.isotipo : o.foto) : null;
  if (!id) return new Response("No encontrado", { status: 404 });
  const [a] = await dbAdmin().select().from(archivos).where(eq(archivos.id, id));
  if (!a || a.organizacionId !== org || a.categoria !== "marca" || !(cual === "foto" ? /^image\/(png|jpeg|webp)$/ : /^image\/(png|svg\+xml|jpeg|webp)$/).test(a.tipoMime)) return new Response("No encontrado", { status: 404 });
  const datos = await leerArchivo(a.rutaRelativa).catch(() => null);
  if (!datos) return new Response("No encontrado", { status: 404 });
  return new Response(new Uint8Array(datos), {
    headers: {
      "Content-Type": a.tipoMime,
      "Content-Length": String(datos.byteLength),
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      "Cross-Origin-Resource-Policy": "same-site",
    },
  });
}
