import { obtenerContexto } from "@/core/contexto";
import { withOrg } from "@/lib/db";
import { generarPdfPropuesta, nombreArchivoPdf } from "@/modules/tesis/pdf/propuesta-pdf";
import { obtenerProyecto } from "@/modules/tesis/servicios/propuestas";

/** PDF de la propuesta para el panel (sesión + módulo tesis + permiso). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const c = await obtenerContexto();
  if (!c?.organizacion || !c.modulos.includes("tesis") || !c.puede("tesis:ver")) return new Response("No autorizado", { status: 403 });
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("No encontrado", { status: 404 });
  const p = await withOrg(c.organizacion.id, (tx) => obtenerProyecto(tx, id));
  if (!p) return new Response("No encontrado", { status: 404 });
  const pdf = await generarPdfPropuesta(p, c.organizacion.nombre);
  return new Response(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${nombreArchivoPdf(p)}"`, "Cache-Control": "private, no-store" },
  });
}
