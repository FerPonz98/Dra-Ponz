"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { guardarBytes, validarArchivo } from "@/core/archivos";
import { requerirPermiso } from "@/core/contexto";
import { organizaciones } from "@/core/db/schema";
import { sanitizarSvg } from "@/core/marca/sanitizar-svg";
import { registrarAuditoria } from "@/core/servicios";
import { guardarTema } from "@/core/tema/servicio";
import type { Tema } from "@/core/tema/tema";
import { ejecutar, type Resultado } from "@/lib/acciones";
import { withOrg } from "@/lib/db";

/** Guarda el tema de la organización activa. Zod valida formato y contraste AA (rechaza combinaciones ilegibles). */
export async function accionGuardarTema(entrada: unknown): Promise<Resultado<Tema>> {
  const ctx = await requerirPermiso("organizacion:configurar");
  const orgId = ctx.organizacion.id;
  const r = await ejecutar(
    () =>
      withOrg(orgId, async (tx) => {
        const t = await guardarTema(tx, orgId, entrada);
        await registrarAuditoria(tx, { organizacionId: orgId, usuarioId: ctx.usuario.id, modulo: "organizacion", accion: "Actualizó la apariencia", detalle: { preset: t.preset } });
        return t;
      }),
    "Apariencia guardada. Tu landing y el portal ya usan los nuevos colores.",
  );
  if (r.ok) {
    // El tema se lee de la BD en cada visita (sin caché entre peticiones): la landing y el portal ya lo muestran.
    revalidatePath("/[locale]", "page");
    revalidatePath("/p/[token]", "page");
    revalidatePath("/panel", "layout");
  }
  return r;
}

const LIMITE_MARCA = 2 * 1024 * 1024; // 2 MB

/**
 * Sube el logo o el isotipo de la organización (SVG o PNG/JPG/WEBP). Los SVG se SANITIZAN (sin scripts, eventos on*,
 * enlaces externos, <style>, <foreignObject>…); los demás se validan por sus primeros bytes.
 */
export async function accionSubirMarca(_: Resultado | null, fd: FormData): Promise<Resultado<{ eliminados: string[] }>> {
  const ctx = await requerirPermiso("organizacion:configurar");
  const orgId = ctx.organizacion.id;
  const r = await ejecutar(async () => {
    const cual = z.enum(["logo", "isotipo"]).parse(fd.get("cual"));
    const archivo = fd.get("archivo");
    if (!(archivo instanceof File) || archivo.size === 0) throw new Error("Elige un archivo SVG o PNG.");
    if (archivo.size > LIMITE_MARCA) throw new Error("El archivo supera 2 MB.");
    const bytes = new Uint8Array(await archivo.arrayBuffer());
    const esSvg = /\.svg$/i.test(archivo.name) || /^\s*(<\?xml|<svg)/i.test(new TextDecoder().decode(bytes.subarray(0, 200)));
    let guardar: { extension: string; mime: string; bytes: Uint8Array };
    let eliminados: string[] = [];
    if (esSvg) {
      const s = sanitizarSvg(new TextDecoder().decode(bytes));
      eliminados = s.eliminados;
      guardar = { extension: "svg", mime: "image/svg+xml", bytes: new TextEncoder().encode(s.svg) };
    } else {
      const v = validarArchivo(archivo.name, archivo.size, bytes.subarray(0, 16), ["imagen"]);
      if (!v.ok) throw new Error(v.error);
      guardar = { extension: v.extension, mime: v.mime, bytes };
    }
    await withOrg(orgId, async (tx) => {
      const a = await guardarBytes(tx, { organizacionId: orgId, categoria: "marca", nombre: archivo.name, subidoPor: ctx.usuario.id, ...guardar });
      await tx.update(organizaciones).set(cual === "logo" ? { logoArchivoId: a.id } : { isotipoArchivoId: a.id }).where(eq(organizaciones.id, orgId));
      await registrarAuditoria(tx, { organizacionId: orgId, usuarioId: ctx.usuario.id, modulo: "organizacion", accion: `Subió ${cual === "logo" ? "el logo" : "el isotipo"}`, detalle: { archivo: archivo.name, eliminados } });
    });
    return { eliminados };
  }, "Listo. Tu marca ya aparece en la landing, el portal y el panel.");
  revalidatePath("/", "layout");
  return r;
}

/** Quita el logo o el isotipo subido: vuelve el de por defecto (la marca incorporada o la inicial). */
export async function accionQuitarMarca(cual: "logo" | "isotipo"): Promise<Resultado> {
  const ctx = await requerirPermiso("organizacion:configurar");
  const orgId = ctx.organizacion.id;
  const c = z.enum(["logo", "isotipo"]).parse(cual);
  const r = await ejecutar(
    () =>
      withOrg(orgId, async (tx) => {
        await tx.update(organizaciones).set(c === "logo" ? { logoArchivoId: null } : { isotipoArchivoId: null }).where(eq(organizaciones.id, orgId));
        await registrarAuditoria(tx, { organizacionId: orgId, usuarioId: ctx.usuario.id, modulo: "organizacion", accion: `Restauró ${c === "logo" ? "el logo" : "el isotipo"} por defecto` });
      }),
    "Se restauró el valor por defecto.",
  );
  revalidatePath("/", "layout");
  return r;
}
