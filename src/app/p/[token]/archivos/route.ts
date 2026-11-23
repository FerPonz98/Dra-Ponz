import { revalidatePath } from "next/cache";
import { mensajeDeError } from "@/lib/acciones";
import { withOrg } from "@/lib/db";
import { subirArchivosEstudiante } from "@/modules/tesis/servicios/formularios";
import { REFERENCIA_PROPUESTA } from "@/modules/tesis/servicios/propuestas";
import { exigirPortal } from "../../sesion";

const LIMITE_PETICION = 52 * 1024 * 1024;

/** Paso 4 del portal del estudiante: un archivo por petición (XHR con progreso). */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  try {
    if (Number(req.headers.get("content-length") ?? 0) > LIMITE_PETICION) throw new Error("El archivo supera el límite de 50 MB.");
    const r = await exigirPortal(token);
    if (r.enlace.referenciaTipo !== REFERENCIA_PROPUESTA || !r.enlace.referenciaId) throw new Error("Este enlace no corresponde a una propuesta.");
    const fd = await req.formData();
    const archivos = fd.getAll("archivos").filter((x): x is File => x instanceof File && x.size > 0);
    const descripcion = String(fd.get("descripcion") ?? "").trim().slice(0, 200) || null;
    await withOrg(r.organizacion.id, (tx) => subirArchivosEstudiante(tx, { organizacionId: r.organizacion.id, propuestaId: r.enlace.referenciaId!, enlaceId: r.enlace.id, archivos, descripcion }));
    revalidatePath(`/p/${token}`);
    return Response.json({ ok: true, mensaje: "Archivos subidos." });
  } catch (e) {
    return Response.json({ ok: false, mensaje: mensajeDeError(e) }, { status: 400 });
  }
}
