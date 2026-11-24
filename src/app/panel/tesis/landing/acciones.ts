"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { borrarDelDisco, guardarBytes, quitarFilasArchivos, validarArchivo } from "@/core/archivos";
import { requerirModulo } from "@/core/contexto";
import { organizaciones } from "@/core/db/schema";
import { registrarAuditoria } from "@/core/servicios";
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

const LIMITE_FOTO = 15 * 1024 * 1024; // 15 MB (una foto de celular); se guarda reducida

/**
 * Foto de la portada de la landing: JPG, PNG o WEBP. Se valida por sus primeros bytes y se guarda como WEBP de hasta
 * 900×1200 px (liviana para el celular) y sin metadatos (la ubicación GPS de la foto no queda publicada).
 */
export async function accionSubirFotoLanding(_: Resultado | null, fd: FormData): Promise<Resultado> {
  const ctx = await requerirModulo("tesis", "tesis:editar");
  const orgId = ctx.organizacion.id;
  const r = await ejecutar(async () => {
    const archivo = fd.get("foto");
    if (!(archivo instanceof File) || archivo.size === 0) throw new Error("Elige una foto (JPG, PNG o WEBP).");
    if (archivo.size > LIMITE_FOTO) throw new Error("La foto supera 15 MB.");
    const bytes = new Uint8Array(await archivo.arrayBuffer());
    const v = validarArchivo(archivo.name, archivo.size, bytes.subarray(0, 16), ["imagen"]);
    if (!v.ok) throw new Error(v.error);
    const sharp = (await import("sharp")).default;
    let webp: Buffer;
    try {
      webp = await sharp(bytes).rotate().resize({ width: 900, height: 1200, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
    } catch {
      throw new Error("No pudimos leer esa imagen. Prueba con otra foto (JPG o PNG).");
    }
    const viejas = await withOrg(orgId, async (tx) => {
      const [antes] = await tx.select({ id: organizaciones.fotoLandingArchivoId }).from(organizaciones).where(eq(organizaciones.id, orgId));
      const a = await guardarBytes(tx, { organizacionId: orgId, categoria: "marca", nombre: archivo.name.replace(/\.\w+$/, ".webp"), extension: "webp", mime: "image/webp", bytes: new Uint8Array(webp), subidoPor: ctx.usuario.id });
      await tx.update(organizaciones).set({ fotoLandingArchivoId: a.id }).where(eq(organizaciones.id, orgId));
      await registrarAuditoria(tx, { organizacionId: orgId, usuarioId: ctx.usuario.id, modulo: "tesis", accion: "Subió la foto de la landing", detalle: { archivo: archivo.name } });
      return quitarFilasArchivos(tx, [antes?.id]); // la foto anterior ya no se usa
    });
    await borrarDelDisco(viejas);
  }, "Foto guardada. Ya aparece en tu página.");
  revalidatePath("/[locale]", "page");
  revalidatePath("/panel/tesis/landing");
  return r;
}

export async function accionQuitarFotoLanding(): Promise<Resultado> {
  const ctx = await requerirModulo("tesis", "tesis:editar");
  const orgId = ctx.organizacion.id;
  const r = await ejecutar(async () => {
    const viejas = await withOrg(orgId, async (tx) => {
      const [antes] = await tx.select({ id: organizaciones.fotoLandingArchivoId }).from(organizaciones).where(eq(organizaciones.id, orgId));
      await tx.update(organizaciones).set({ fotoLandingArchivoId: null }).where(eq(organizaciones.id, orgId));
      await registrarAuditoria(tx, { organizacionId: orgId, usuarioId: ctx.usuario.id, modulo: "tesis", accion: "Quitó la foto de la landing" });
      return quitarFilasArchivos(tx, [antes?.id]);
    });
    await borrarDelDisco(viejas);
  }, "Foto quitada.");
  revalidatePath("/[locale]", "page");
  revalidatePath("/panel/tesis/landing");
  return r;
}
