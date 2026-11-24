// Migración de producción (la usan migrar.ts al arrancar y restaurar.ts): espera a Postgres, aplica las migraciones de Drizzle con el rol
// DUEÑO, crea/actualiza el rol de la APP (sin superusuario ni BYPASSRLS: sujeto a RLS) y le da permisos.
// Idempotente y protegido con un lock: la app y el worker pueden arrancar a la vez sin pisarse.
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";
import { esperarPostgres, log, urlDueno } from "./comun";

const ident = (s: string) => `"${s.replace(/"/g, '""')}"`;
const literal = (s: string) => `'${s.replace(/'/g, "''")}'`;

export async function migrarProduccion() {
  const dueno = urlDueno();
  const app = process.env.DATABASE_URL;
  if (!app) throw new Error("Falta DATABASE_URL (conexión con el rol de la app)");
  await esperarPostgres(dueno);
  const ua = new URL(app);
  const usuarioApp = decodeURIComponent(ua.username);
  const claveApp = decodeURIComponent(ua.password);
  const base = decodeURIComponent(new URL(dueno).pathname.slice(1));
  if (usuarioApp === decodeURIComponent(new URL(dueno).username)) throw new Error("DATABASE_URL y DATABASE_URL_OWNER deben usar usuarios DISTINTOS (la app no puede ser la dueña: RLS no la limitaría)");

  const c = new Client({ connectionString: dueno });
  await c.connect();
  try {
    await c.query("select pg_advisory_lock(hashtext('draponz:migraciones'))");
    // 1) Rol de la app (si el dueño puede crear roles; en Easypanel el usuario de Postgres es superusuario)
    const existe = (await c.query("select 1 from pg_roles where rolname = $1", [usuarioApp])).rowCount;
    try {
      await c.query(`${existe ? "ALTER" : "CREATE"} ROLE ${ident(usuarioApp)} LOGIN PASSWORD ${literal(claveApp)} NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB`);
      log(`Rol de la app "${usuarioApp}": ${existe ? "actualizado" : "creado"} (sin BYPASSRLS)`);
    } catch (e) {
      if (!existe) throw new Error(`No se pudo crear el rol "${usuarioApp}": ${(e as Error).message}. Créalo a mano o usa un dueño con CREATEROLE.`);
      log(`Rol de la app "${usuarioApp}" ya existe (sin permisos para actualizarlo: se deja como está)`);
    }
    const r = (await c.query<{ rolsuper: boolean; rolbypassrls: boolean }>("select rolsuper, rolbypassrls from pg_roles where rolname = $1", [usuarioApp])).rows[0];
    if (r.rolsuper || r.rolbypassrls) throw new Error(`El rol "${usuarioApp}" es superusuario u omite RLS: la app no puede usarlo.`);

    // 2) Migraciones
    await migrate(drizzle(c), { migrationsFolder: resolve(process.cwd(), "drizzle") });
    log("Migraciones aplicadas");

    // 3) Permisos de la app (mismos que scripts/migrar.ts)
    await c.query(`GRANT CONNECT ON DATABASE ${ident(base)} TO ${ident(usuarioApp)}`);
    await c.query(`GRANT USAGE ON SCHEMA public TO ${ident(usuarioApp)}`);
    await c.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${ident(usuarioApp)}`);
    await c.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${ident(usuarioApp)}`);
    await c.query(`REVOKE ALL ON usuarios, sesiones, cuentas, verificaciones, limites_auth, intentos_login FROM ${ident(usuarioApp)}`);
    log("Permisos del rol de la app al día");
  } finally {
    await c.query("select pg_advisory_unlock(hashtext('draponz:migraciones'))").catch(() => undefined);
    await c.end();
  }
}

