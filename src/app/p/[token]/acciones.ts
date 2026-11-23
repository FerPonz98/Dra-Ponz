"use server";
import { revalidatePath } from "next/cache";
import type { Resultado } from "@/lib/acciones";
import { intentarAcceso } from "@/modules/cobros/servicios/enlaces";
import { abrirSesionPortal, sesionPortal } from "../sesion";

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
