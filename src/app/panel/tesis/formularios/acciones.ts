"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requerirModulo } from "@/core/contexto";
import { ejecutar, type Resultado } from "@/lib/acciones";
import { withOrg } from "@/lib/db";
import { guardarFormulario, type DatosFormulario } from "@/modules/tesis/servicios/formularios";

export async function accionGuardarFormulario(datos: DatosFormulario, id?: string): Promise<Resultado<{ id: string }>> {
  const ctx = await requerirModulo("tesis", "tesis:editar");
  const r = await ejecutar(async () => ({ id: await withOrg(ctx.organizacion.id, (tx) => guardarFormulario(tx, ctx.organizacion.id, datos, id ? z.uuid().parse(id) : undefined)) }), "Formulario guardado.");
  revalidatePath("/panel/tesis/formularios");
  return r;
}
