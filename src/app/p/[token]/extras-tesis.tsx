import type { ExtrasPortalTesis } from "@/modules/tesis/componentes/portal-tesis";
import type { Proyecto } from "@/modules/tesis/servicios/propuestas";

/** Bloques de los pasos 3 y 4 (formulario y archivos) y solicitudes de extras. Se completan en la fase 4. */
export async function extrasPortalTesis(token: string, organizacionId: string, p: Proyecto): Promise<ExtrasPortalTesis> {
  void token;
  void organizacionId;
  void p;
  return {};
}
