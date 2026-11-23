import { eq } from "drizzle-orm";
import type { Ejecutor } from "@/lib/db";
import { centavosATexto } from "@/lib/dinero";
import { formatoFecha } from "@/lib/fechas";
import { PLANTILLAS_BASE, rellenarPlantilla, type ClavePlantilla, type Variables } from "@/modules/cobros/dominio/mensajes";
import { plantillasMensaje } from "@/modules/cobros/schema";

export async function plantillasDeOrganizacion(tx: Ejecutor) {
  const guardadas = await tx.select().from(plantillasMensaje);
  return PLANTILLAS_BASE.map((b) => {
    const g = guardadas.find((x) => x.clave === b.clave);
    return { clave: b.clave as ClavePlantilla, titulo: g?.titulo ?? b.titulo, cuerpo: g?.cuerpo ?? b.cuerpo, personalizada: !!g };
  });
}

/** Siembra las plantillas base de una organización (idempotente). */
export async function sembrarPlantillas(tx: Ejecutor, organizacionId: string) {
  await tx
    .insert(plantillasMensaje)
    .values(PLANTILLAS_BASE.map((p) => ({ organizacionId, clave: p.clave, titulo: p.titulo, cuerpo: p.cuerpo })))
    .onConflictDoNothing();
}

export async function guardarPlantilla(tx: Ejecutor, organizacionId: string, clave: ClavePlantilla, cuerpo: string) {
  const base = PLANTILLAS_BASE.find((p) => p.clave === clave);
  if (!base) throw new Error("Plantilla desconocida");
  const c = cuerpo.trim();
  if (c.length < 5 || c.length > 1000) throw new Error("El mensaje debe tener entre 5 y 1000 caracteres");
  await tx
    .insert(plantillasMensaje)
    .values({ organizacionId, clave, titulo: base.titulo, cuerpo: c })
    .onConflictDoUpdate({ target: [plantillasMensaje.organizacionId, plantillasMensaje.clave], set: { cuerpo: c, actualizadoEn: new Date() } });
}

export async function mensaje(tx: Ejecutor, clave: ClavePlantilla, v: Variables) {
  const [g] = await tx.select().from(plantillasMensaje).where(eq(plantillasMensaje.clave, clave));
  const cuerpo = g?.cuerpo ?? PLANTILLAS_BASE.find((p) => p.clave === clave)!.cuerpo;
  return rellenarPlantilla(cuerpo, v);
}

export const vars = (d: { nombre: string; montoCentavos?: number; moneda?: string; fecha?: string | null; enlace?: string | null; proyecto?: string }): Variables => ({
  nombre: d.nombre.split(" ")[0],
  monto: d.montoCentavos !== undefined ? centavosATexto(d.montoCentavos) : "",
  moneda: d.moneda ?? "",
  fecha: d.fecha ? formatoFecha(d.fecha) : "",
  enlace: d.enlace ?? "",
  proyecto: d.proyecto ?? "",
});
