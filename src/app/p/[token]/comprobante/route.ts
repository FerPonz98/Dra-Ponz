import { revalidatePath } from "next/cache";
import { z } from "zod";
import { estadoDeError, mensajeDeError } from "@/lib/acciones";
import { withOrg } from "@/lib/db";
import { exigirLimite, exigirMismoOrigen } from "@/lib/seguridad";
import { hoyEnZona } from "@/lib/fechas";
import { registrarPago } from "@/modules/cobros/servicios/pagos";
import { exigirPortal } from "../../sesion";

const LIMITE_PETICION = 52 * 1024 * 1024;

/** Subida del comprobante desde el portal (XHR con barra de progreso). Requiere sesión de portal. */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  try {
    exigirMismoOrigen(req);
    exigirLimite(req.headers, "subida-comprobante", 20);
    if (Number(req.headers.get("content-length") ?? 0) > LIMITE_PETICION) throw new Error("El archivo supera el límite de 50 MB.");
    const r = await exigirPortal(token);
    const fd = await req.formData();
    const cuotaId = z.uuid().parse(fd.get("cuotaId"));
    const archivo = fd.get("comprobante");
    if (!(archivo instanceof File) || archivo.size === 0) throw new Error("Adjunta la foto o PDF del comprobante.");
    await withOrg(r.organizacion.id, (tx) => registrarPago(tx, { organizacionId: r.organizacion.id, planId: r.enlace.planId, cuotaId, enlaceId: r.enlace.id, archivo, hoy: hoyEnZona(r.organizacion.zonaHoraria) }));
    revalidatePath(`/p/${token}`);
    return Response.json({ ok: true, mensaje: "¡Comprobante enviado! Te avisaremos cuando sea aprobado." });
  } catch (e) {
    return Response.json({ ok: false, mensaje: mensajeDeError(e) }, { status: estadoDeError(e) });
  }
}
