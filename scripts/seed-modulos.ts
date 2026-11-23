// Datos base por módulo (plantillas, contenido de landing…). Cada fase agrega lo suyo aquí. Idempotente.
import type { CodigoModulo } from "@/core/db/schema";
import { withOrg } from "@/lib/db";
import { sembrarPlantillas } from "@/modules/cobros/servicios/mensajes";

export async function sembrarModulos(organizacionId: string, modulos: CodigoModulo[]) {
  await withOrg(organizacionId, async (tx) => {
    if (modulos.includes("cobros")) await sembrarPlantillas(tx, organizacionId);
  });
}
