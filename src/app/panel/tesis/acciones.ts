"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actorDe, hoyDe, requerirModulo } from "@/core/contexto";
import { ejecutar, type Resultado } from "@/lib/acciones";
import { withOrg } from "@/lib/db";
import { mensaje, vars } from "@/modules/cobros/servicios/mensajes";
import type { DatosCronograma } from "@/modules/tesis/dominio/cronograma";
import {
  aprobarSolicitud,
  cambiarEstadoManual,
  enviarPropuesta,
  guardarNotas,
  guardarPropuesta,
  marcarActividad,
  marcarRevision,
  obtenerProyecto,
  proponerNuevoCronograma,
  sincronizarProyecto,
  type DatosPropuesta,
} from "@/modules/tesis/servicios/propuestas";

const uuid = z.uuid();
const ruta = (id: string) => `/panel/tesis/propuestas/${id}`;

export async function accionGuardarPropuesta(datos: DatosPropuesta, id?: string): Promise<Resultado<{ id: string }>> {
  const ctx = await requerirModulo("tesis", "tesis:editar");
  const r = await ejecutar(() =>
    withOrg(ctx.organizacion.id, async (tx) => {
      const p = await guardarPropuesta(tx, actorDe(ctx), datos, id ? uuid.parse(id) : undefined);
      return { id: p.id };
    }),
  );
  revalidatePath("/panel/tesis/propuestas");
  return r;
}

export async function accionEnviarPropuesta(id: string, metodo: "ci" | "pin"): Promise<Resultado<{ url: string; pin: string | null; mensaje: string; whatsapp: string | null }>> {
  const ctx = await requerirModulo("tesis", "tesis:editar");
  const r = await ejecutar(() =>
    withOrg(ctx.organizacion.id, async (tx) => {
      const e = await enviarPropuesta(tx, actorDe(ctx), uuid.parse(id), z.enum(["ci", "pin"]).parse(metodo));
      const p = (await obtenerProyecto(tx, id))!;
      const texto = await mensaje(tx, "enviar_plan", vars({ nombre: p.cliente.nombre, enlace: e.url, proyecto: p.propuesta.titulo, fecha: e.expiraEn.toISOString().slice(0, 10) }));
      return { url: e.url, pin: e.pin, mensaje: texto, whatsapp: p.cliente.whatsapp };
    }),
  );
  revalidatePath(ruta(id));
  return r;
}

export async function accionMarcarActividad(propuestaId: string, actividadId: string, hecha: boolean): Promise<Resultado> {
  const ctx = await requerirModulo("tesis", "tesis:editar");
  const r = await ejecutar(() => withOrg(ctx.organizacion.id, (tx) => marcarActividad(tx, uuid.parse(actividadId), hecha)));
  revalidatePath(ruta(propuestaId));
  return r;
}

export async function accionMarcarRevision(propuestaId: string, revisionId: string, hecha: boolean): Promise<Resultado> {
  const ctx = await requerirModulo("tesis", "tesis:editar");
  const r = await ejecutar(() => withOrg(ctx.organizacion.id, (tx) => marcarRevision(tx, uuid.parse(revisionId), hecha)));
  revalidatePath(ruta(propuestaId));
  return r;
}

export async function accionCambiarEstado(propuestaId: string, estado: "tribunal" | "finalizado" | "en_curso"): Promise<Resultado> {
  const ctx = await requerirModulo("tesis", "tesis:editar");
  const e = z.enum(["tribunal", "finalizado", "en_curso"]).parse(estado);
  const r = await ejecutar(() => withOrg(ctx.organizacion.id, (tx) => cambiarEstadoManual(tx, actorDe(ctx), uuid.parse(propuestaId), e)), "Estado actualizado.");
  revalidatePath(ruta(propuestaId));
  return r;
}

export async function accionProponerCronograma(propuestaId: string, c: DatosCronograma): Promise<Resultado> {
  const ctx = await requerirModulo("tesis", "tesis:editar");
  const r = await ejecutar(() => withOrg(ctx.organizacion.id, (tx) => proponerNuevoCronograma(tx, actorDe(ctx), uuid.parse(propuestaId), c)), "Nuevo cronograma enviado al estudiante para que lo acepte.");
  revalidatePath(ruta(propuestaId));
  return r;
}

export async function accionAprobarSolicitud(propuestaId: string, tipo: "revision" | "extra", refId: string): Promise<Resultado> {
  const ctx = await requerirModulo("tesis", "tesis:editar");
  const r = await ejecutar(
    () => withOrg(ctx.organizacion.id, (tx) => aprobarSolicitud(tx, actorDe(ctx), uuid.parse(propuestaId), z.enum(["revision", "extra"]).parse(tipo), uuid.parse(refId), hoyDe(ctx))),
    "Solicitud aprobada: se agregó la cuota al plan de pagos.",
  );
  revalidatePath(ruta(propuestaId));
  return r;
}

export async function accionGuardarNotas(propuestaId: string, notas: string): Promise<Resultado> {
  const ctx = await requerirModulo("tesis", "tesis:editar");
  const r = await ejecutar(() => withOrg(ctx.organizacion.id, (tx) => guardarNotas(tx, uuid.parse(propuestaId), z.string().max(5000).parse(notas))), "Notas guardadas.");
  revalidatePath(ruta(propuestaId));
  return r;
}

export async function accionSincronizar(propuestaId: string): Promise<Resultado> {
  const ctx = await requerirModulo("tesis", "tesis:ver");
  return ejecutar(() => withOrg(ctx.organizacion.id, (tx) => sincronizarProyecto(tx, uuid.parse(propuestaId), hoyDe(ctx))));
}
