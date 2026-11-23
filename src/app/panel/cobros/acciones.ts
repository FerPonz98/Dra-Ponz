"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { actorDe, hoyDe, requerirModulo } from "@/core/contexto";
import { ejecutar, type Resultado } from "@/lib/acciones";
import { withOrg } from "@/lib/db";
import type { CuotaEditable, ReglasMora } from "@/modules/cobros/dominio/plan";
import { actualizarCliente, crearCliente, type DatosCliente } from "@/modules/cobros/servicios/clientes";
import { anularEnlace, crearEnlace, urlPortal } from "@/modules/cobros/servicios/enlaces";
import { aprobarPago, rechazarPago } from "@/modules/cobros/servicios/pagos";
import { cambiarMonedaYTitulo, crearPlan, guardarCuotas, guardarReglas, recalcularMora, type DatosPlan } from "@/modules/cobros/servicios/planes";
import { sincronizarTrasPago } from "@/app/panel/sincronizar";
import { PLANTILLAS_BASE, type ClavePlantilla } from "@/modules/cobros/dominio/mensajes";
import { guardarPlantilla } from "@/modules/cobros/servicios/mensajes";

const uuid = z.uuid();

export async function accionCrearCliente(datos: DatosCliente): Promise<Resultado<{ id: string }>> {
  const ctx = await requerirModulo("cobros", "cobros:editar");
  return ejecutar(async () => {
    const c = await withOrg(ctx.organizacion.id, (tx) => crearCliente(tx, ctx.organizacion.id, datos));
    revalidatePath("/panel/cobros/clientes");
    return { id: c.id };
  }, "Cliente guardado.");
}

export async function accionActualizarCliente(id: string, datos: DatosCliente): Promise<Resultado> {
  const ctx = await requerirModulo("cobros", "cobros:editar");
  const r = await ejecutar(() => withOrg(ctx.organizacion.id, (tx) => actualizarCliente(tx, uuid.parse(id), datos)), "Cliente actualizado.");
  revalidatePath(`/panel/cobros/clientes/${id}`);
  return r.ok ? { ok: true, mensaje: r.mensaje } : r;
}

export async function accionCrearPlan(datos: DatosPlan): Promise<Resultado<{ id: string }>> {
  const ctx = await requerirModulo("cobros", "cobros:editar");
  const r = await ejecutar(() =>
    withOrg(ctx.organizacion.id, async (tx) => {
      const p = await crearPlan(tx, actorDe(ctx), datos);
      await recalcularMora(tx, p.id, hoyDe(ctx), ctx.organizacion.zonaHoraria);
      return { id: p.id };
    }),
  );
  if (r.ok && r.datos) redirect(`/panel/cobros/planes/${r.datos.id}`);
  return r;
}

export async function accionGuardarCuotas(planId: string, lista: CuotaEditable[]): Promise<Resultado> {
  const ctx = await requerirModulo("cobros", "cobros:editar");
  const r = await ejecutar(async () => {
    await withOrg(ctx.organizacion.id, async (tx) => {
      await guardarCuotas(tx, actorDe(ctx), uuid.parse(planId), lista);
      await recalcularMora(tx, planId, hoyDe(ctx), ctx.organizacion.zonaHoraria);
    });
  }, "Cuotas guardadas.");
  revalidatePath(`/panel/cobros/planes/${planId}`);
  return r;
}

export async function accionGuardarReglas(planId: string, reglas: ReglasMora): Promise<Resultado> {
  const ctx = await requerirModulo("cobros", "cobros:editar");
  const r = await ejecutar(async () => {
    await withOrg(ctx.organizacion.id, async (tx) => {
      await guardarReglas(tx, actorDe(ctx), uuid.parse(planId), reglas);
      await recalcularMora(tx, planId, hoyDe(ctx), ctx.organizacion.zonaHoraria);
    });
  }, "Reglas de mora guardadas.");
  revalidatePath(`/panel/cobros/planes/${planId}`);
  return r;
}

export async function accionDatosPlan(planId: string, d: { titulo: string; moneda: "BOB" | "BRL" }): Promise<Resultado> {
  const ctx = await requerirModulo("cobros", "cobros:editar");
  const v = z.object({ titulo: z.string().trim().min(2).max(200), moneda: z.enum(["BOB", "BRL"]) }).parse(d);
  const r = await ejecutar(() => withOrg(ctx.organizacion.id, (tx) => cambiarMonedaYTitulo(tx, actorDe(ctx), uuid.parse(planId), v)), "Datos guardados.");
  revalidatePath(`/panel/cobros/planes/${planId}`);
  return r;
}

export async function accionCrearEnlace(planId: string, metodo: "ci" | "pin"): Promise<Resultado<{ url: string; pin: string | null }>> {
  const ctx = await requerirModulo("cobros", "cobros:editar");
  const r = await ejecutar(() =>
    withOrg(ctx.organizacion.id, async (tx) => {
      const e = await crearEnlace(tx, { organizacionId: ctx.organizacion.id, planId: uuid.parse(planId), metodo: z.enum(["ci", "pin"]).parse(metodo) });
      return { url: urlPortal(e.token), pin: e.pin };
    }),
  );
  revalidatePath(`/panel/cobros/planes/${planId}`);
  return r;
}

export async function accionAnularEnlace(planId: string, enlaceId: string): Promise<Resultado> {
  const ctx = await requerirModulo("cobros", "cobros:editar");
  const r = await ejecutar(() => withOrg(ctx.organizacion.id, (tx) => anularEnlace(tx, uuid.parse(enlaceId))), "Enlace anulado.");
  revalidatePath(`/panel/cobros/planes/${planId}`);
  return r;
}

export async function accionAprobarPago(pagoId: string): Promise<Resultado> {
  const ctx = await requerirModulo("cobros", "cobros:aprobar");
  const r = await ejecutar(async () => {
    const { pago } = await withOrg(ctx.organizacion.id, (tx) => aprobarPago(tx, actorDe(ctx), uuid.parse(pagoId), hoyDe(ctx), ctx.organizacion.zonaHoraria));
    await sincronizarTrasPago(ctx, pago.planId);
  }, "Pago aprobado.");
  revalidatePath("/panel/cobros/pagos");
  revalidatePath("/panel");
  return r;
}

export async function accionRechazarPago(pagoId: string, motivo: string): Promise<Resultado> {
  const ctx = await requerirModulo("cobros", "cobros:aprobar");
  const r = await ejecutar(() => withOrg(ctx.organizacion.id, (tx) => rechazarPago(tx, actorDe(ctx), uuid.parse(pagoId), motivo)), "Pago rechazado.");
  revalidatePath("/panel/cobros/pagos");
  return r;
}

export async function accionGuardarPlantilla(clave: string, cuerpo: string): Promise<Resultado> {
  const ctx = await requerirModulo("cobros", "cobros:editar");
  const c = z.enum(PLANTILLAS_BASE.map((p) => p.clave) as [ClavePlantilla, ...ClavePlantilla[]]).parse(clave);
  const r = await ejecutar(() => withOrg(ctx.organizacion.id, (tx) => guardarPlantilla(tx, ctx.organizacion.id, c, cuerpo)), "Plantilla guardada.");
  revalidatePath("/panel/cobros/plantillas");
  return r;
}
