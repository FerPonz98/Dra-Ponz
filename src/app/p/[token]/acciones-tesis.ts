"use server";
import { revalidatePath } from "next/cache";
import { ejecutar, type Resultado } from "@/lib/acciones";
import { withOrg } from "@/lib/db";
import { hoyEnZona } from "@/lib/fechas";
import { aceptarNuevoCronograma, aceptarPropuesta, REFERENCIA_PROPUESTA, sincronizarProyecto } from "@/modules/tesis/servicios/propuestas";
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
