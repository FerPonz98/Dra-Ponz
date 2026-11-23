import "server-only";
import type { ContextoOrg } from "@/core/contexto";

/**
 * Punto de unión entre módulos (capa app): después de un cambio en Cobros, los módulos que dependen de él
 * (Tesis) actualizan su propio estado. Cobros no conoce a Tesis; esta capa sí puede importar ambos.
 */
export async function sincronizarTrasPago(ctx: ContextoOrg, planId: string): Promise<void> {
  void ctx;
  void planId;
}

/** Parte de Tesis del job diario (vigencia de propuestas y estados de proyectos). */
export async function jobTesisDiario(ahora: Date): Promise<unknown[]> {
  void ahora;
  return [];
}
