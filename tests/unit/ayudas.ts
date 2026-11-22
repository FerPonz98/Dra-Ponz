import { inArray } from "drizzle-orm";
import { organizaciones } from "@/core/db/schema";
import { withAdmin } from "@/lib/db";

/** Crea organizaciones temporales para pruebas y devuelve una función para borrarlas. */
export async function crearOrgsDePrueba(n: number) {
  const sufijo = Math.random().toString(36).slice(2, 8);
  const orgs = await withAdmin((tx) =>
    tx
      .insert(organizaciones)
      .values(Array.from({ length: n }, (_, i) => ({ slug: `test-${sufijo}-${i}`, nombre: `Prueba ${i} ${sufijo}` })))
      .returning(),
  );
  return {
    orgs,
    borrar: () =>
      withAdmin((tx) =>
        tx.delete(organizaciones).where(
          inArray(
            organizaciones.id,
            orgs.map((o) => o.id),
          ),
        ),
      ),
  };
}
