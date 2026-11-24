import { eq } from "drizzle-orm";
import { leerArchivo } from "@/core/archivos";
import { archivos, organizaciones } from "@/core/db/schema";
import { dbAdmin } from "@/lib/db";

/**
 * Logo e isotipo subidos por una organización (públicos: se ven en la landing, el portal y los correos).
 * Solo sirve archivos de la categoría "marca" asociados a esa organización. Los SVG ya están sanitizados al subirse
 * y además se sirven con CSP sandbox y nosniff (aunque se abran directo, no ejecutan nada).
 */
export async function GET(_req: Request, ctx: { params: Promise<{ org: string; cual: string }> }) {
  const { org, cual } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(org) || (cual !== "logo" && cual !== "isotipo")) return new Response("No encontrado", { status: 404 });
  const [o] = await dbAdmin().select({ logo: organizaciones.logoArchivoId, isotipo: organizaciones.isotipoArchivoId, suspendida: organizaciones.suspendida }).from(organizaciones).where(eq(organizaciones.id, org));
  const id = o && !o.suspendida ? (cual === "logo" ? o.logo : o.isotipo) : null;
  if (!id) return new Response("No encontrado", { status: 404 });
  const [a] = await dbAdmin().select().from(archivos).where(eq(archivos.id, id));
  if (!a || a.organizacionId !== org || a.categoria !== "marca" || !/^image\/(png|svg\+xml|jpeg|webp)$/.test(a.tipoMime)) return new Response("No encontrado", { status: 404 });
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
