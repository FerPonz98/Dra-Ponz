import { and, count, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { hashPassword } from "better-auth/crypto";
import { archivos, auditoria, cuentas, MODULOS, organizacionModulos, organizaciones, roles, usuarios, type CodigoModulo } from "@/core/db/schema";
import { TODOS_LOS_PERMISOS } from "@/core/permisos";
import { dbAdmin, withAdmin, type Ejecutor } from "@/lib/db";

export const esquemaOrganizacion = z.object({
  nombre: z.string().trim().min(2).max(120),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{1,60}$/, "Solo minúsculas, números y guiones"),
  monedaDefecto: z.enum(["BOB", "BRL"]).default("BOB"),
  dominio: z.string().trim().max(200).optional().nullable(),
  modulos: z.array(z.enum(MODULOS)).default(["cobros"]),
  adminNombre: z.string().trim().min(2).max(120),
  adminCorreo: z.email().trim().toLowerCase(),
  adminContrasena: z.string().min(8).max(128),
});

export async function hashContrasena(contrasena: string) {
  return hashPassword(contrasena);
}

/** Crea un usuario con contraseña (sin auto-registro: lo hace el superadmin o el admin de la org). */
export async function crearUsuario(
  tx: Ejecutor,
  datos: { nombre: string; correo: string; contrasena: string; organizacionId: string | null; rolId: string | null; esSuperadmin?: boolean },
) {
  const id = crypto.randomUUID();
  const correo = datos.correo.trim().toLowerCase();
  const [existe] = await tx.select({ id: usuarios.id }).from(usuarios).where(eq(usuarios.email, correo));
  if (existe) throw new Error("Ya existe un usuario con ese correo");
  await tx.insert(usuarios).values({
    id,
    name: datos.nombre,
    email: correo,
    emailVerified: true,
    organizacionId: datos.organizacionId,
    rolId: datos.rolId,
    esSuperadmin: datos.esSuperadmin ?? false,
  });
  await tx.insert(cuentas).values({ id: crypto.randomUUID(), accountId: id, providerId: "credential", userId: id, password: await hashContrasena(datos.contrasena) });
  return id;
}

/** Superadmin: crea organización + módulos + rol Administrador + usuario admin. */
export async function crearOrganizacion(entrada: z.input<typeof esquemaOrganizacion>) {
  const d = esquemaOrganizacion.parse(entrada);
  return withAdmin(async (tx) => {
    const [org] = await tx
      .insert(organizaciones)
      .values({ nombre: d.nombre, slug: d.slug, monedaDefecto: d.monedaDefecto, dominio: d.dominio || null })
      .returning();
    for (const m of MODULOS) await tx.insert(organizacionModulos).values({ organizacionId: org.id, modulo: m, activo: d.modulos.includes(m) });
    const [admin] = await tx.insert(roles).values({ organizacionId: org.id, nombre: "Administrador", permisos: TODOS_LOS_PERMISOS, esAdmin: true }).returning();
    await tx.insert(roles).values({ organizacionId: org.id, nombre: "Asistente", permisos: ["cobros:ver", "tesis:ver"] });
    await crearUsuario(tx, { nombre: d.adminNombre, correo: d.adminCorreo, contrasena: d.adminContrasena, organizacionId: org.id, rolId: admin.id });
    return org;
  });
}

export async function cambiarModulo(organizacionId: string, modulo: CodigoModulo, activo: boolean) {
  await withAdmin(async (tx) => {
    await tx
      .insert(organizacionModulos)
      .values({ organizacionId, modulo, activo })
      .onConflictDoUpdate({ target: [organizacionModulos.organizacionId, organizacionModulos.modulo], set: { activo, actualizadoEn: new Date() } });
  });
}

export async function suspenderOrganizacion(organizacionId: string, suspendida: boolean) {
  await withAdmin(async (tx) => {
    await tx.update(organizaciones).set({ suspendida }).where(eq(organizaciones.id, organizacionId));
  });
}

/** Resumen de uso para el superadmin (consulta con el rol dueño, sin RLS). */
export async function usoDeOrganizaciones() {
  const tx = dbAdmin();
  {
    const orgs = await tx.select().from(organizaciones).orderBy(organizaciones.creadoEn);
    const mods = await tx.select().from(organizacionModulos);
    const nUsuarios = await tx.select({ org: usuarios.organizacionId, n: count() }).from(usuarios).groupBy(usuarios.organizacionId);
    const bytes = await tx
      .select({ org: archivos.organizacionId, n: sql<number>`coalesce(sum(${archivos.tamanoBytes}),0)::bigint` })
      .from(archivos)
      .groupBy(archivos.organizacionId);
    const conteos = await tx.execute<{ org: string; tabla: string; n: number }>(sql`
      select organizacion_id as org, 'clientes' as tabla, count(*)::int as n from clientes group by 1
      union all select organizacion_id, 'planes', count(*)::int from planes_pago group by 1
    `).catch(() => ({ rows: [] as { org: string; tabla: string; n: number }[] }));
    return orgs.map((o) => ({
      ...o,
      modulos: mods.filter((m) => m.organizacionId === o.id),
      usuarios: nUsuarios.find((x) => x.org === o.id)?.n ?? 0,
      bytesArchivos: Number(bytes.find((x) => x.org === o.id)?.n ?? 0),
      clientes: conteos.rows.find((x) => x.org === o.id && x.tabla === "clientes")?.n ?? 0,
      planes: conteos.rows.find((x) => x.org === o.id && x.tabla === "planes")?.n ?? 0,
    }));
  }
}

export async function registrarAuditoria(
  tx: Ejecutor,
  d: { organizacionId: string; usuarioId?: string | null; modulo: string; accion: string; entidad?: string; entidadId?: string; detalle?: unknown },
) {
  await tx.insert(auditoria).values({
    organizacionId: d.organizacionId,
    usuarioId: d.usuarioId ?? null,
    modulo: d.modulo,
    accion: d.accion,
    entidad: d.entidad,
    entidadId: d.entidadId,
    detalle: d.detalle ?? null,
  });
}

export async function usuariosDeOrganizacion(organizacionId: string) {
  return withAdmin((tx) =>
    tx
      .select({ id: usuarios.id, nombre: usuarios.name, correo: usuarios.email, activo: usuarios.activo, rolId: usuarios.rolId, rol: roles.nombre })
      .from(usuarios)
      .leftJoin(roles, eq(roles.id, usuarios.rolId))
      .where(and(eq(usuarios.organizacionId, organizacionId), eq(usuarios.esSuperadmin, false))),
  );
}
