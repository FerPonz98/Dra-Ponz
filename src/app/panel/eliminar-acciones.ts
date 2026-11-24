"use server";
// Eliminar clientes, planes, propuestas y formularios. Vive en la capa de rutas porque combina Cobros y Tesis
// (Cobros no conoce a Tesis). Todo en una transacción con RLS; los archivos se quitan del disco después del commit.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { borrarDelDisco } from "@/core/archivos";
import { requerirModulo } from "@/core/contexto";
import { registrarAuditoria } from "@/core/servicios";
import { ejecutar, type Resultado } from "@/lib/acciones";
import { withOrg } from "@/lib/db";
import { eliminarCliente, obtenerCliente } from "@/modules/cobros/servicios/clientes";
import { eliminarPlan } from "@/modules/cobros/servicios/planes";
import { eliminarFormulario } from "@/modules/tesis/servicios/formularios";
import { eliminarPropuesta, propuestaDePlan, propuestasDeCliente } from "@/modules/tesis/servicios/propuestas";

const uuid = z.uuid();

export async function accionEliminarCliente(id: string): Promise<Resultado> {
  const ctx = await requerirModulo("cobros", "cobros:editar");
  const org = ctx.organizacion.id;
  const r = await ejecutar(async () => {
    const rutas = await withOrg(org, async (tx) => {
      const c = await obtenerCliente(tx, uuid.parse(id));
      if (!c) throw new Error("Cliente no encontrado");
      const lista: string[] = [];
      // Sus propuestas de tesis (si el módulo está activo) arrastran su plan; luego los planes sueltos y el cliente.
      if (ctx.modulos.includes("tesis")) for (const p of await propuestasDeCliente(tx, c.id)) lista.push(...(await eliminarPropuesta(tx, p.id)));
      lista.push(...(await eliminarCliente(tx, c.id)));
      await registrarAuditoria(tx, { organizacionId: org, usuarioId: ctx.usuario.id, modulo: "cobros", accion: "Eliminó un cliente", entidad: "cliente", entidadId: c.id, detalle: { nombre: c.nombre } });
      return lista;
    });
    await borrarDelDisco(rutas);
  });
  if (!r.ok) return r;
  revalidatePath("/panel", "layout");
  redirect("/panel/cobros/clientes?eliminado=1");
}

export async function accionEliminarPlan(id: string): Promise<Resultado> {
  const ctx = await requerirModulo("cobros", "cobros:editar");
  const org = ctx.organizacion.id;
  const r = await ejecutar(async () => {
    const rutas = await withOrg(org, async (tx) => {
      const planId = uuid.parse(id);
      if (await propuestaDePlan(tx, planId)) throw new Error("Este plan pertenece a una propuesta de tesis: elimínalo desde la propuesta.");
      const lista = await eliminarPlan(tx, planId);
      await registrarAuditoria(tx, { organizacionId: org, usuarioId: ctx.usuario.id, modulo: "cobros", accion: "Eliminó un plan de pagos", entidad: "plan", entidadId: planId });
      return lista;
    });
    await borrarDelDisco(rutas);
  });
  if (!r.ok) return r;
  revalidatePath("/panel", "layout");
  redirect("/panel/cobros/planes?eliminado=1");
}

export async function accionEliminarPropuesta(id: string): Promise<Resultado> {
  const ctx = await requerirModulo("tesis", "tesis:editar");
  const org = ctx.organizacion.id;
  const r = await ejecutar(async () => {
    const rutas = await withOrg(org, async (tx) => {
      const lista = await eliminarPropuesta(tx, uuid.parse(id));
      await registrarAuditoria(tx, { organizacionId: org, usuarioId: ctx.usuario.id, modulo: "tesis", accion: "Eliminó una propuesta", entidad: "propuesta", entidadId: id });
      return lista;
    });
    await borrarDelDisco(rutas);
  });
  if (!r.ok) return r;
  revalidatePath("/panel", "layout");
  redirect("/panel/tesis/propuestas?eliminado=1");
}

export async function accionEliminarFormulario(id: string): Promise<Resultado> {
  const ctx = await requerirModulo("tesis", "tesis:editar");
  const org = ctx.organizacion.id;
  const r = await ejecutar(() =>
    withOrg(org, async (tx) => {
      await eliminarFormulario(tx, uuid.parse(id));
      await registrarAuditoria(tx, { organizacionId: org, usuarioId: ctx.usuario.id, modulo: "tesis", accion: "Eliminó un formulario", entidad: "formulario", entidadId: id });
    }),
  );
  if (!r.ok) return r;
  revalidatePath("/panel/tesis/formularios");
  redirect("/panel/tesis/formularios?eliminado=1");
}
