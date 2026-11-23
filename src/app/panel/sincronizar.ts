import "server-only";
import { and, eq } from "drizzle-orm";
import type { ContextoOrg } from "@/core/contexto";
import { organizacionModulos, organizaciones } from "@/core/db/schema";
import { dbAdmin, withOrg } from "@/lib/db";
import { hoyEnZona } from "@/lib/fechas";
import { sincronizarPorPlan, sincronizarTodos } from "@/modules/tesis/servicios/propuestas";

/**
 * Punto de unión entre módulos (capa app): después de un cambio en Cobros, los módulos que dependen de él
 * (Tesis) actualizan su propio estado. Cobros no conoce a Tesis; esta capa sí puede importar ambos.
 */
export async function sincronizarTrasPago(ctx: ContextoOrg, planId: string): Promise<void> {
  if (!ctx.modulos.includes("tesis")) return;
  await withOrg(ctx.organizacion.id, (tx) => sincronizarPorPlan(tx, planId, hoyEnZona(ctx.organizacion.zonaHoraria)));
}

/** Parte de Tesis del job diario: vence propuestas (destruye enlaces) y recalcula estados de proyectos. */
export async function jobTesisDiario(ahora: Date) {
  const orgs = await dbAdmin()
    .select({ id: organizaciones.id, nombre: organizaciones.nombre, zona: organizaciones.zonaHoraria })
    .from(organizaciones)
    .innerJoin(organizacionModulos, and(eq(organizacionModulos.organizacionId, organizaciones.id), eq(organizacionModulos.modulo, "tesis"), eq(organizacionModulos.activo, true)))
    .where(eq(organizaciones.suspendida, false));
  const salida = [];
  for (const o of orgs) {
    const r = await withOrg(o.id, (tx) => sincronizarTodos(tx, hoyEnZona(o.zona, ahora), ahora));
    salida.push({ organizacion: o.nombre, ...r });
  }
  return salida;
}
