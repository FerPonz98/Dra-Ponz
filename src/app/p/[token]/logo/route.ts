import { eq } from "drizzle-orm";
import { leerArchivo } from "@/core/archivos";
import { archivos } from "@/core/db/schema";
import { dbAdmin } from "@/lib/db";
import { resolverToken } from "@/modules/cobros/servicios/enlaces";

/** Logo de la organización para el encabezado del portal (solo con un enlace válido). */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const r = await resolverToken(token);
  if (!r?.organizacion.logoArchivoId) return new Response("No disponible", { status: 404 });
  const [a] = await dbAdmin().select().from(archivos).where(eq(archivos.id, r.organizacion.logoArchivoId));
  if (!a || !a.tipoMime.startsWith("image/")) return new Response("No disponible", { status: 404 });
  const datos = await leerArchivo(a.rutaRelativa).catch(() => null);
  if (!datos) return new Response("No disponible", { status: 404 });
  return new Response(new Uint8Array(datos), { headers: { "Content-Type": a.tipoMime, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" } });
}
