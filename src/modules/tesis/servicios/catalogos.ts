import { asc, eq } from "drizzle-orm";
import type { Ejecutor } from "@/lib/db";
import { extrasCatalogo, formularios } from "@/modules/tesis/schema";

export async function listarFormulariosActivos(tx: Ejecutor) {
  return tx.select({ id: formularios.id, nombre: formularios.nombre }).from(formularios).where(eq(formularios.activo, true)).orderBy(asc(formularios.nombre));
}

export async function extrasDelCatalogo(tx: Ejecutor) {
  return tx.select().from(extrasCatalogo).where(eq(extrasCatalogo.activo, true)).orderBy(asc(extrasCatalogo.nombre));
}

/** Extra por defecto: diapositivas para la sustentación (configurable desde el panel). */
export async function sembrarExtras(tx: Ejecutor, organizacionId: string) {
  const ya = await tx.select().from(extrasCatalogo).limit(1);
  if (ya.length) return;
  await tx.insert(extrasCatalogo).values({ organizacionId, nombre: "Diapositivas para la sustentación", precioCentavos: 30000 });
}
