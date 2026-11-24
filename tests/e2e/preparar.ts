import "dotenv/config";
import { randomBytes } from "node:crypto";
import { Client } from "pg";
import { crearOrganizacion, crearUsuario } from "@/core/servicios";
import { cerrarPools, withAdmin } from "@/lib/db";

/** Correos de los usuarios SOLO de prueba: se crean al empezar la corrida y se borran al terminar (limpiar.ts). */
export const SUPERADMIN_E2E = "superadmin-e2e@example.com";
export const DEMO_E2E = "demo-e2e@example.com";

/**
 * Antes de cada corrida E2E: borra datos de prueba de corridas anteriores y crea un superadmin y la
 * organización "Demo Dentista" solo para las pruebas (en la base real quedan únicamente sus administradores).
 */
export default async function preparar() {
  const c = new Client({ connectionString: process.env.DATABASE_ADMIN_URL });
  await c.connect();
  const patrones = ["Cliente E2E %", "Moroso %", "Estudiante E2E %"];
  for (const p of patrones) {
    await c.query("delete from propuestas where cliente_id in (select id from clientes where nombre like $1)", [p]);
    await c.query("delete from planes_pago where cliente_id in (select id from clientes where nombre like $1)", [p]);
    await c.query("delete from clientes where nombre like $1", [p]).catch(() => undefined);
  }
  await c.query("delete from organizaciones where slug like 'test-%'");
  await borrarUsuariosDePrueba(c);
  await c.end();

  // Usuarios de prueba con contraseñas aleatorias (los workers heredan estas variables)
  process.env.SUPERADMIN_EMAIL = SUPERADMIN_E2E;
  process.env.SUPERADMIN_PASSWORD = randomBytes(18).toString("base64url");
  process.env.DEMO_EMAIL = DEMO_E2E;
  process.env.DEMO_PASSWORD = randomBytes(18).toString("base64url");
  await withAdmin((tx) => crearUsuario(tx, { nombre: "Superadmin E2E", correo: SUPERADMIN_E2E, contrasena: process.env.SUPERADMIN_PASSWORD!, organizacionId: null, rolId: null, esSuperadmin: true }));
  await crearOrganizacion({ nombre: "Demo Dentista", slug: "demo-dentista", modulos: ["cobros"], monedaDefecto: "BOB", adminNombre: "Administrador Demo", adminCorreo: DEMO_E2E, adminContrasena: process.env.DEMO_PASSWORD! });
  await cerrarPools();
}

/** Borra los usuarios y la organización que crean las pruebas (también los de fase 6). */
export async function borrarUsuariosDePrueba(c: Client) {
  await c.query("delete from organizaciones where slug = 'demo-dentista'"); // en cascada: roles, usuarios, datos
  await c.query("delete from usuarios where correo in ($1, $2) or correo like 'asistente-e2e-%@example.com'", [SUPERADMIN_E2E, DEMO_E2E]);
  await c.query("delete from intentos_login where correo like '%@example.com'");
}
