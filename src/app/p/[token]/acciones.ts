"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ejecutar, type Resultado } from "@/lib/acciones";
import { withOrg } from "@/lib/db";
import { hoyEnZona } from "@/lib/fechas";
import { intentarAcceso } from "@/modules/cobros/servicios/enlaces";
import { registrarPago } from "@/modules/cobros/servicios/pagos";
import { abrirSesionPortal, exigirPortal, sesionPortal } from "../sesion";

export async function accionAccederPortal(token: string, _: Resultado | null, fd: FormData): Promise<Resultado> {
  const { resuelto } = await sesionPortal(token);
  if (!resuelto) return { ok: false, mensaje: "El enlace no está disponible." };
  const valor = String(fd.get("credencial") ?? "");
  const r = await intentarAcceso(resuelto, valor);
  if (r.ok) {
    await abrirSesionPortal(resuelto.enlace.id);
    revalidatePath(`/p/${token}`);
    return { ok: true, mensaje: "Acceso concedido." };
  }
  if (r.bloqueado) {
    const hasta = r.hasta ? new Intl.DateTimeFormat("es-BO", { timeZone: resuelto.organizacion.zonaHoraria, timeStyle: "short" }).format(r.hasta) : "";
    return { ok: false, mensaje: `Demasiados intentos fallidos. El acceso está bloqueado por 15 minutos${hasta ? ` (hasta las ${hasta})` : ""}.` };
  }
  return { ok: false, mensaje: `Dato incorrecto. Te quedan ${r.restantes} intento${r.restantes === 1 ? "" : "s"}.` };
}

export async function accionSubirComprobante(token: string, _: Resultado | null, fd: FormData): Promise<Resultado> {
  return ejecutar(async () => {
    const r = await exigirPortal(token);
    const cuotaId = z.uuid().parse(fd.get("cuotaId"));
    const archivo = fd.get("comprobante");
    if (!(archivo instanceof File) || archivo.size === 0) throw new Error("Adjunta la foto o PDF del comprobante.");
    const hoy = hoyEnZona(r.organizacion.zonaHoraria);
    await withOrg(r.organizacion.id, (tx) =>
      registrarPago(tx, { organizacionId: r.organizacion.id, planId: r.enlace.planId, cuotaId, enlaceId: r.enlace.id, archivo, hoy }),
    );
    revalidatePath(`/p/${token}`);
  }, "¡Comprobante enviado! Te avisaremos cuando sea aprobado.");
}
