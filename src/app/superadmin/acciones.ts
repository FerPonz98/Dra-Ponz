"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requerirSuperadmin } from "@/core/contexto";
import { MODULOS } from "@/core/db/schema";
import { cambiarModulo, crearOrganizacion, suspenderOrganizacion } from "@/core/servicios";

export type Resultado = { ok: boolean; mensaje: string };

export async function accionCrearOrganizacion(_: Resultado | null, fd: FormData): Promise<Resultado> {
  await requerirSuperadmin();
  try {
    await crearOrganizacion({
      nombre: String(fd.get("nombre") ?? ""),
      slug: String(fd.get("slug") ?? ""),
      monedaDefecto: fd.get("monedaDefecto") === "BRL" ? "BRL" : "BOB",
      dominio: String(fd.get("dominio") ?? "") || null,
      modulos: fd.getAll("modulos").map(String) as (typeof MODULOS)[number][],
      adminNombre: String(fd.get("adminNombre") ?? ""),
      adminCorreo: String(fd.get("adminCorreo") ?? ""),
      adminContrasena: String(fd.get("adminContrasena") ?? ""),
    });
    revalidatePath("/superadmin");
    return { ok: true, mensaje: "Organización creada." };
  } catch (e) {
    const msg = e instanceof z.ZodError ? e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") : e instanceof Error ? e.message : "Error";
    return { ok: false, mensaje: msg.includes("duplicate") ? "El slug ya existe." : msg };
  }
}

const esquemaModulo = z.object({ organizacionId: z.uuid(), modulo: z.enum(MODULOS), activo: z.enum(["true", "false"]) });
export async function accionCambiarModulo(fd: FormData) {
  await requerirSuperadmin();
  const d = esquemaModulo.parse(Object.fromEntries(fd));
  await cambiarModulo(d.organizacionId, d.modulo, d.activo === "true");
  revalidatePath("/superadmin");
}

const esquemaSuspender = z.object({ organizacionId: z.uuid(), suspendida: z.enum(["true", "false"]) });
export async function accionSuspender(fd: FormData) {
  await requerirSuperadmin();
  const d = esquemaSuspender.parse(Object.fromEntries(fd));
  await suspenderOrganizacion(d.organizacionId, d.suspendida === "true");
  revalidatePath("/superadmin");
}
