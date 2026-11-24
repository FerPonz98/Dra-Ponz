import "server-only";
import { eq, sql } from "drizzle-orm";
import { intentosLogin } from "@/core/db/schema";
import { dbAdmin } from "@/lib/db";

export const MAX_FALLIDOS_LOGIN = 10;
export const MINUTOS_BLOQUEO_LOGIN = 15;

const normalizar = (correo: string) => correo.trim().toLowerCase().slice(0, 320);

export async function estaBloqueadaCuenta(correo: string, ahora = new Date()): Promise<boolean> {
  const c = normalizar(correo);
  if (!c) return false;
  const [f] = await dbAdmin().select({ hasta: intentosLogin.bloqueadoHasta }).from(intentosLogin).where(eq(intentosLogin.correo, c));
  return !!f?.hasta && f.hasta > ahora;
}

/** Cuenta un intento. Un acierto borra el contador; el fallo N.º MAX bloquea MINUTOS y reinicia el conteo. */
export async function registrarIntentoLogin(correo: string, exito: boolean) {
  const c = normalizar(correo);
  if (!c) return;
  if (exito) {
    await dbAdmin().delete(intentosLogin).where(eq(intentosLogin.correo, c));
    return;
  }
  // Atómico (sirve con varias peticiones a la vez y varios procesos).
  await dbAdmin().execute(sql`
    insert into intentos_login (correo, fallidos, bloqueado_hasta, actualizado_en) values (${c}, 1, null, now())
    on conflict (correo) do update set
      fallidos = case when intentos_login.fallidos + 1 >= ${MAX_FALLIDOS_LOGIN} then 0 else intentos_login.fallidos + 1 end,
      bloqueado_hasta = case when intentos_login.fallidos + 1 >= ${MAX_FALLIDOS_LOGIN} then now() + make_interval(mins => ${MINUTOS_BLOQUEO_LOGIN}) else intentos_login.bloqueado_hasta end,
      actualizado_en = now()`);
}
