// Datos base por módulo (plantillas, contenido de landing…). Cada fase agrega lo suyo aquí. Idempotente.
import type { CodigoModulo } from "@/core/db/schema";

export async function sembrarModulos(organizacionId: string, modulos: CodigoModulo[]) {
  void organizacionId;
  void modulos;
}
