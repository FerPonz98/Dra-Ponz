import { eq } from "drizzle-orm";
import { leerArchivo } from "@/core/archivos";
import { obtenerContexto } from "@/core/contexto";
import { archivos } from "@/core/db/schema";
import { dbAdmin, withOrg } from "@/lib/db";
import { enlacesPortal } from "@/modules/cobros/schema";
import { planesConSesionPortal } from "@/app/p/sesion";

type Archivo = typeof archivos.$inferSelect;

/**
 * Descarga de archivos SOLO con autorización:
 * - usuario del panel de la misma organización (consulta con RLS), o
 * - visitante del portal con sesión válida para el plan dueño del archivo.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("No encontrado", { status: 404 });

  let archivo: Archivo | null = null;
  const panel = await obtenerContexto();
  if (panel?.organizacion) {
    [archivo] = await withOrg(panel.organizacion.id, (tx) => tx.select().from(archivos).where(eq(archivos.id, id)));
  }
  if (!archivo) {
    const [a] = await dbAdmin().select().from(archivos).where(eq(archivos.id, id));
    if (a?.enlaceId) {
      const [e] = await dbAdmin().select({ planId: enlacesPortal.planId }).from(enlacesPortal).where(eq(enlacesPortal.id, a.enlaceId));
      if (e && (await planesConSesionPortal()).has(e.planId)) archivo = a;
    }
  }
  if (!archivo) return new Response("No autorizado", { status: 404 });

  const datos = await leerArchivo(archivo.rutaRelativa);
  const enLinea = archivo.tipoMime.startsWith("image/") || archivo.tipoMime === "application/pdf";
  return new Response(new Uint8Array(datos), {
    headers: {
      "Content-Type": archivo.tipoMime,
      "Content-Length": String(datos.byteLength),
      "Content-Disposition": `${enLinea ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(archivo.nombreOriginal)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
    },
  });
}
