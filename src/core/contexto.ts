import "server-only";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/core/auth/auth";
import { organizacionModulos, organizaciones, roles, usuarios, type CodigoModulo } from "@/core/db/schema";
import { permisosEfectivos, type Permiso } from "@/core/permisos";
import { dbAdmin } from "@/lib/db";

export type Organizacion = typeof organizaciones.$inferSelect;

export type Contexto = {
  usuario: { id: string; nombre: string; correo: string; esSuperadmin: boolean };
  organizacion: Organizacion | null;
  modulos: CodigoModulo[];
  permisos: Permiso[];
  puede: (p: Permiso) => boolean;
};

export async function cargarContextoDeUsuario(usuarioId: string): Promise<Contexto | null> {
  const db = dbAdmin();
  const [u] = await db.select().from(usuarios).where(eq(usuarios.id, usuarioId));
  if (!u || !u.activo) return null;
  const usuario = { id: u.id, nombre: u.name, correo: u.email, esSuperadmin: u.esSuperadmin };
  if (u.esSuperadmin || !u.organizacionId) {
    return { usuario, organizacion: null, modulos: [], permisos: [], puede: () => false };
  }
  const [org] = await db.select().from(organizaciones).where(eq(organizaciones.id, u.organizacionId));
  if (!org || org.suspendida) return null;
  const mods = await db
    .select({ modulo: organizacionModulos.modulo })
    .from(organizacionModulos)
    .where(and(eq(organizacionModulos.organizacionId, org.id), eq(organizacionModulos.activo, true)));
  const modulos = mods.map((m) => m.modulo);
  const [rol] = u.rolId ? await db.select().from(roles).where(eq(roles.id, u.rolId)) : [];
  const permisos = permisosEfectivos(rol ?? null, modulos);
  return { usuario, organizacion: org, modulos, permisos, puede: (p) => permisos.includes(p) };
}

/** Contexto de la petición actual (cacheado por petición). null si no hay sesión válida. */
export const obtenerContexto = cache(async (): Promise<Contexto | null> => {
  const sesion = await auth().api.getSession({ headers: await headers() });
  if (!sesion) return null;
  return cargarContextoDeUsuario(sesion.user.id);
});

export async function requerirSesion(): Promise<Contexto> {
  const ctx = await obtenerContexto();
  if (!ctx) redirect("/login");
  return ctx;
}

export type ContextoOrg = Contexto & { organizacion: Organizacion };

export async function requerirOrganizacion(): Promise<ContextoOrg> {
  const ctx = await requerirSesion();
  if (!ctx.organizacion) redirect(ctx.usuario.esSuperadmin ? "/superadmin" : "/login");
  return ctx as ContextoOrg;
}

export async function requerirModulo(modulo: CodigoModulo, permiso?: Permiso): Promise<ContextoOrg> {
  const ctx = await requerirOrganizacion();
  if (!ctx.modulos.includes(modulo)) forbidden();
  if (permiso && !ctx.puede(permiso)) forbidden();
  return ctx;
}

export async function requerirPermiso(permiso: Permiso): Promise<ContextoOrg> {
  const ctx = await requerirOrganizacion();
  if (!ctx.puede(permiso)) forbidden();
  return ctx;
}

export async function requerirSuperadmin(): Promise<Contexto> {
  const ctx = await requerirSesion();
  if (!ctx.usuario.esSuperadmin) forbidden();
  return ctx;
}
