"use server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requerirPermiso } from "@/core/contexto";
import { roles } from "@/core/db/schema";
import { actualizarUsuarioDeOrganizacion, crearUsuarioDeOrganizacion, guardarRol, registrarAuditoria } from "@/core/servicios";
import { ejecutar, type Resultado } from "@/lib/acciones";
import { withOrg } from "@/lib/db";

const ruta = "/panel/usuarios";

export async function accionGuardarRol(datos: { nombre: string; permisos: string[] }, id?: string): Promise<Resultado> {
  const ctx = await requerirPermiso("usuarios:gestionar");
  const r = await ejecutar(
    () =>
      withOrg(ctx.organizacion.id, async (tx) => {
        const rolId = await guardarRol(tx, ctx.organizacion.id, datos, id ? z.uuid().parse(id) : undefined);
        await registrarAuditoria(tx, { organizacionId: ctx.organizacion.id, usuarioId: ctx.usuario.id, modulo: "usuarios", accion: id ? "Editó un rol" : "Creó un rol", entidad: "rol", entidadId: rolId, detalle: datos });
      }),
    "Rol guardado.",
  );
  revalidatePath(ruta);
  return r;
}

export async function accionCrearUsuario(datos: { nombre: string; correo: string; contrasena: string; rolId: string }): Promise<Resultado> {
  const ctx = await requerirPermiso("usuarios:gestionar");
  const org = ctx.organizacion.id;
  // El rol se verifica con RLS: solo existe si es de esta organización.
  const r = await ejecutar(
    () => crearUsuarioDeOrganizacion(org, datos, async (rolId) => (await withOrg(org, (tx) => tx.select({ id: roles.id }).from(roles).where(eq(roles.id, rolId)))).length > 0),
    "Usuario creado. Comparte la contraseña inicial por un medio seguro.",
  );
  revalidatePath(ruta);
  return r;
}

export async function accionActualizarUsuario(usuarioId: string, cambios: { rolId?: string; activo?: boolean }): Promise<Resultado> {
  const ctx = await requerirPermiso("usuarios:gestionar");
  const org = ctx.organizacion.id;
  const r = await ejecutar(async () => {
    if (usuarioId === ctx.usuario.id && cambios.activo === false) throw new Error("No puedes desactivar tu propia cuenta.");
    if (cambios.rolId) {
      const ok = (await withOrg(org, (tx) => tx.select({ id: roles.id }).from(roles).where(eq(roles.id, z.uuid().parse(cambios.rolId))))).length > 0;
      if (!ok) throw new Error("Rol no válido");
    }
    await actualizarUsuarioDeOrganizacion(org, z.string().min(1).parse(usuarioId), cambios);
  }, "Usuario actualizado.");
  revalidatePath(ruta);
  return r;
}
