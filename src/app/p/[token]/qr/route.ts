import { eq } from "drizzle-orm";
import { leerArchivo } from "@/core/archivos";
import { archivos } from "@/core/db/schema";
import { dbAdmin } from "@/lib/db";
import { sesionPortal } from "../../sesion";

/** Imagen del QR estático de la organización, solo para visitantes con sesión de portal. */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const s = await sesionPortal(token);
  if (!s.resuelto || !s.autorizado || !s.resuelto.organizacion.qrArchivoId) return new Response("No disponible", { status: 404 });
  const [a] = await dbAdmin().select().from(archivos).where(eq(archivos.id, s.resuelto.organizacion.qrArchivoId));
  if (!a) return new Response("No disponible", { status: 404 });
  const datos = await leerArchivo(a.rutaRelativa).catch(() => null);
  if (!datos) return new Response("No disponible", { status: 404 });
  return new Response(new Uint8Array(datos), { headers: { "Content-Type": a.tipoMime, "Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff" } });
}
