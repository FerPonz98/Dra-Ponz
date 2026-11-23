"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ejecutar, mensajeDeError, type Resultado } from "@/lib/acciones";
import { withOrg } from "@/lib/db";
import { hoyEnZona } from "@/lib/fechas";
import { ErroresFormulario, guardarRespuestas, subirArchivosEstudiante } from "@/modules/tesis/servicios/formularios";
import { aceptarNuevoCronograma, aceptarPropuesta, REFERENCIA_PROPUESTA, sincronizarProyecto, solicitarExtra, solicitarTerceraRevision } from "@/modules/tesis/servicios/propuestas";
import { exigirPortal } from "../sesion";

/** Sesión de portal válida y enlace de una propuesta de tesis. */
async function exigirPropuesta(token: string) {
  const r = await exigirPortal(token);
  if (r.enlace.referenciaTipo !== REFERENCIA_PROPUESTA || !r.enlace.referenciaId) throw new Error("Este enlace no corresponde a una propuesta.");
  return { ...r, propuestaId: r.enlace.referenciaId, hoy: hoyEnZona(r.organizacion.zonaHoraria) };
}

export async function accionAceptarPropuesta(token: string): Promise<Resultado> {
  const r = await ejecutar(async () => {
    const s = await exigirPropuesta(token);
    await withOrg(s.organizacion.id, async (tx) => {
      await aceptarPropuesta(tx, s.propuestaId);
      await sincronizarProyecto(tx, s.propuestaId, s.hoy);
    });
  }, "¡Propuesta aceptada! Ahora paga la primera cuota para comenzar.");
  revalidatePath(`/p/${token}`);
  return r;
}

export async function accionAceptarCronograma(token: string): Promise<Resultado> {
  const r = await ejecutar(async () => {
    const s = await exigirPropuesta(token);
    await withOrg(s.organizacion.id, (tx) => aceptarNuevoCronograma(tx, s.propuestaId, s.hoy));
  }, "Cronograma aceptado.");
  revalidatePath(`/p/${token}`);
  return r;
}

export async function accionEnviarFormulario(token: string, _: Resultado | null, fd: FormData): Promise<Resultado> {
  try {
    const s = await exigirPropuesta(token);
    await withOrg(s.organizacion.id, (tx) => guardarRespuestas(tx, { organizacionId: s.organizacion.id, propuestaId: s.propuestaId, enlaceId: s.enlace.id, fd }));
  } catch (e) {
    if (e instanceof ErroresFormulario) {
      return { ok: false, mensaje: `Revisa los campos: ${Object.values(e.errores).join(" · ")}` };
    }
    return { ok: false, mensaje: mensajeDeError(e) };
  }
  revalidatePath(`/p/${token}`);
  return { ok: true, mensaje: "Formulario enviado. ¡Gracias!" };
}

export async function accionSubirArchivos(token: string, _: Resultado | null, fd: FormData): Promise<Resultado> {
  const r = await ejecutar(async () => {
    const s = await exigirPropuesta(token);
    const archivos = fd.getAll("archivos").filter((x): x is File => x instanceof File && x.size > 0);
    const descripcion = String(fd.get("descripcion") ?? "").trim().slice(0, 200) || null;
    await withOrg(s.organizacion.id, (tx) => subirArchivosEstudiante(tx, { organizacionId: s.organizacion.id, propuestaId: s.propuestaId, enlaceId: s.enlace.id, archivos, descripcion }));
  }, "Archivos subidos.");
  revalidatePath(`/p/${token}`);
  return r;
}

export async function accionSolicitarRevision(token: string): Promise<Resultado> {
  const r = await ejecutar(async () => {
    const s = await exigirPropuesta(token);
    await withOrg(s.organizacion.id, (tx) => solicitarTerceraRevision(tx, s.propuestaId));
  }, "Pediste la 3.ª revisión. La asesora la confirmará y se agregará la cuota.");
  revalidatePath(`/p/${token}`);
  return r;
}

export async function accionSolicitarExtra(token: string, extraId: string): Promise<Resultado> {
  const r = await ejecutar(async () => {
    const s = await exigirPropuesta(token);
    await withOrg(s.organizacion.id, (tx) => solicitarExtra(tx, s.propuestaId, z.uuid().parse(extraId)));
  }, "Solicitud enviada.");
  revalidatePath(`/p/${token}`);
  return r;
}
