"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requerirModulo } from "@/core/contexto";
import { ejecutar, type Resultado } from "@/lib/acciones";
import { withOrg } from "@/lib/db";
import { guardarContenidoLanding } from "@/modules/tesis/servicios/landing";

export async function accionGuardarLanding(idioma: "es" | "pt", valores: Record<string, string>): Promise<Resultado> {
  const ctx = await requerirModulo("tesis", "tesis:editar");
  const d = z.object({ idioma: z.enum(["es", "pt"]), valores: z.record(z.string(), z.string().max(5000)) }).parse({ idioma, valores });
  const r = await ejecutar(() => withOrg(ctx.organizacion.id, (tx) => guardarContenidoLanding(tx, ctx.organizacion.id, d.idioma, d.valores)), "Textos guardados. La página pública ya muestra los cambios.");
  revalidatePath(`/${d.idioma}`);
  return r;
}
