import { marcaParaPdf } from "@/core/marca/servidor";
import { withOrg } from "@/lib/db";
import { generarPdfPropuesta, nombreArchivoPdf } from "@/modules/tesis/pdf/propuesta-pdf";
import { obtenerProyecto, REFERENCIA_PROPUESTA } from "@/modules/tesis/servicios/propuestas";
import { sesionPortal } from "../../sesion";

/** PDF de la propuesta para el estudiante (requiere sesión de portal). */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const s = await sesionPortal(token);
  if (!s.resuelto || !s.autorizado || s.resuelto.enlace.referenciaTipo !== REFERENCIA_PROPUESTA || !s.resuelto.enlace.referenciaId) return new Response("No disponible", { status: 404 });
  const { organizacion, enlace } = s.resuelto;
  const p = await withOrg(organizacion.id, (tx) => obtenerProyecto(tx, enlace.referenciaId!));
  if (!p) return new Response("No disponible", { status: 404 });
  const pdf = await generarPdfPropuesta(p, await marcaParaPdf(organizacion.id));
  return new Response(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${nombreArchivoPdf(p)}"`, "Cache-Control": "private, no-store" },
  });
}
