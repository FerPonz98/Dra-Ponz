// Restablece la contraseña de un usuario del panel cuando el correo de recuperación no funciona (p. ej. sin
// RESEND_API_KEY/SMTP). Se corre a mano en la consola del servicio App de Easypanel:
//   npm run usuario:clave -- correo@ejemplo.com
// Genera una contraseña ALEATORIA que se muestra UNA vez, cierra todas las sesiones del usuario y quita el bloqueo por
// intentos fallidos. No cambia nada más.
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { cuentas, intentosLogin, sesiones, usuarios } from "@/core/db/schema";
import { hashContrasena } from "@/core/servicios";
import { cerrarPools, withAdmin } from "@/lib/db";
import { esperarPostgres, urlDueno } from "./comun";

async function main() {
  const correo = process.argv.slice(2).find((a) => !a.startsWith("-"))?.trim().toLowerCase();
  if (!correo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) throw new Error("Uso: npm run usuario:clave -- correo@ejemplo.com");
  await esperarPostgres(urlDueno());
  const clave = randomBytes(12).toString("base64url"); // 16 caracteres aleatorios
  const nombre = await withAdmin(async (tx) => {
    const [u] = await tx.select({ id: usuarios.id, nombre: usuarios.name, activo: usuarios.activo }).from(usuarios).where(eq(usuarios.email, correo));
    if (!u) throw new Error(`No existe un usuario con el correo ${correo}`);
    const r = await tx
      .update(cuentas)
      .set({ password: await hashContrasena(clave), updatedAt: new Date() })
      .where(and(eq(cuentas.userId, u.id), eq(cuentas.providerId, "credential")))
      .returning({ id: cuentas.id });
    if (!r.length) throw new Error("El usuario no tiene contraseña registrada (cuenta sin credenciales)");
    await tx.delete(sesiones).where(eq(sesiones.userId, u.id));
    await tx.delete(intentosLogin).where(eq(intentosLogin.correo, correo));
    if (!u.activo) console.warn("⚠ Este usuario está DESACTIVADO: actívalo en Panel → Usuarios y roles para que pueda entrar.");
    return u.nombre;
  });
  console.log("\n════════════════════════════════════════════════════════════");
  console.log(` Contraseña restablecida para ${nombre} (${correo})`);
  console.log(`   Nueva contraseña: ${clave}`);
  console.log(" Se cerraron sus sesiones abiertas. Cópiala ahora: no se vuelve a mostrar.");
  console.log("════════════════════════════════════════════════════════════\n");
}

main()
  .catch((e) => {
    console.error(`✗ ${(e as Error).message}`);
    process.exitCode = 1;
  })
  .finally(() => cerrarPools());
