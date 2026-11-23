import "server-only";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { dbAdmin } from "@/lib/db";
import { firmarSesionPortal, HORAS_SESION_PORTAL, nombreCookiePortal, verificarSesionPortal } from "@/modules/cobros/dominio/portal";
import { enlacesPortal } from "@/modules/cobros/schema";
import { resolverToken, type EnlaceResuelto } from "@/modules/cobros/servicios/enlaces";

/** Resuelve el token y dice si el visitante ya validó su CI/PIN (cookie firmada). */
export async function sesionPortal(token: string): Promise<{ resuelto: EnlaceResuelto | null; autorizado: boolean }> {
  const resuelto = await resolverToken(token);
  if (!resuelto) return { resuelto: null, autorizado: false };
  const valor = (await cookies()).get(nombreCookiePortal(resuelto.enlace.id))?.value;
  return { resuelto, autorizado: verificarSesionPortal(valor, resuelto.enlace.id) };
}

export async function abrirSesionPortal(enlaceId: string) {
  (await cookies()).set(nombreCookiePortal(enlaceId), firmarSesionPortal(enlaceId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && (process.env.APP_URL ?? "").startsWith("https"),
    path: "/",
    maxAge: HORAS_SESION_PORTAL * 3600,
  });
}

/** Planes a los que el visitante tiene acceso por alguna cookie de portal válida. */
export async function planesConSesionPortal(): Promise<Set<string>> {
  const planes = new Set<string>();
  for (const c of (await cookies()).getAll()) {
    if (!c.name.startsWith("portal_")) continue;
    const enlaceId = c.value.split(".")[0];
    if (!/^[0-9a-f-]{36}$/i.test(enlaceId) || !verificarSesionPortal(c.value, enlaceId)) continue;
    const [e] = await dbAdmin().select({ planId: enlacesPortal.planId, token: enlacesPortal.token }).from(enlacesPortal).where(eq(enlacesPortal.id, enlaceId));
    if (e?.token) planes.add(e.planId);
  }
  return planes;
}

/** Requiere sesión de portal válida; devuelve el enlace resuelto. (No es una server action.) */
export async function exigirPortal(token: string) {
  const s = await sesionPortal(token);
  if (!s.resuelto || !s.autorizado) throw new Error("Tu sesión venció. Vuelve a ingresar tu CI o PIN.");
  return s.resuelto;
}
