"use server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { guardarArchivo } from "@/core/archivos";
import { requerirPermiso } from "@/core/contexto";
import { organizaciones } from "@/core/db/schema";
import { registrarAuditoria } from "@/core/servicios";
import { ejecutar, type Resultado } from "@/lib/acciones";
import { withOrg } from "@/lib/db";

const esquema = z.object({
  nombre: z.string().trim().min(2).max(120),
  whatsapp: z.string().trim().transform((v) => v.replace(/\D/g, "")).refine((v) => v === "" || (v.length >= 8 && v.length <= 15), "WhatsApp inválido"),
  monedaDefecto: z.enum(["BOB", "BRL"]),
  datosBancarios: z.string().trim().max(1000),
});

export async function accionGuardarOrganizacion(_: Resultado | null, fd: FormData): Promise<Resultado> {
  const ctx = await requerirPermiso("organizacion:configurar");
  const r = await ejecutar(async () => {
    const d = esquema.parse(Object.fromEntries(["nombre", "whatsapp", "monedaDefecto", "datosBancarios"].map((k) => [k, String(fd.get(k) ?? "")])));
    const orgId = ctx.organizacion.id;
    await withOrg(orgId, async (tx) => {
      const cambios: Partial<typeof organizaciones.$inferInsert> = { ...d, whatsapp: d.whatsapp || null, datosBancarios: d.datosBancarios || null };
      for (const campo of ["qr"] as const) {
        const f = fd.get(campo);
        if (f instanceof File && f.size > 0) {
          const a = await guardarArchivo(tx, { organizacionId: orgId, categoria: "marca", archivo: f, permitidos: ["imagen"], subidoPor: ctx.usuario.id });
          cambios.qrArchivoId = a.id;
        }
      }
      await tx.update(organizaciones).set(cambios).where(eq(organizaciones.id, orgId));
      await registrarAuditoria(tx, { organizacionId: orgId, usuarioId: ctx.usuario.id, modulo: "organizacion", accion: "Actualizó la organización", detalle: { campos: Object.keys(cambios) } });
    });
  }, "Cambios guardados.");
  revalidatePath("/panel", "layout");
  return r;
}
