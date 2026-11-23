// Datos base por módulo (plantillas, extras, contenido de landing…). Idempotente.
import type { CodigoModulo } from "@/core/db/schema";
import { withOrg } from "@/lib/db";
import { sembrarPlantillas } from "@/modules/cobros/servicios/mensajes";
import { sembrarExtras } from "@/modules/tesis/servicios/catalogos";
import { sembrarLanding } from "@/modules/tesis/servicios/landing";

export async function sembrarModulos(organizacionId: string, modulos: CodigoModulo[]) {
  await withOrg(organizacionId, async (tx) => {
    if (modulos.includes("cobros")) await sembrarPlantillas(tx, organizacionId);
    if (modulos.includes("tesis")) {
      await sembrarExtras(tx, organizacionId);
      await sembrarLanding(tx, organizacionId);
    }
  });
}
