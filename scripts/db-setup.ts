// Crea la base, el rol dueño (migraciones) y el rol de la app (sujeto a RLS). Idempotente.
// Uso: npm run db:setup  (requiere PG_SUPERUSER_URL, DATABASE_ADMIN_URL y DATABASE_URL)
import "dotenv/config";
import { Client } from "pg";

function partes(url: string) {
  const u = new URL(url);
  return { usuario: decodeURIComponent(u.username), clave: decodeURIComponent(u.password), base: u.pathname.slice(1) };
}
const ident = (s: string) => `"${s.replace(/"/g, '""')}"`;
const literal = (s: string) => `'${s.replace(/'/g, "''")}'`;

async function main() {
  const superUrl = process.env.PG_SUPERUSER_URL;
  const adminUrl = process.env.DATABASE_ADMIN_URL;
  const appUrl = process.env.DATABASE_URL;
  if (!superUrl || !adminUrl || !appUrl) throw new Error("Faltan PG_SUPERUSER_URL, DATABASE_ADMIN_URL o DATABASE_URL");
  const dueno = partes(adminUrl);
  const app = partes(appUrl);

  const su = new Client({ connectionString: superUrl });
  await su.connect();
  for (const r of [dueno, app]) {
    const existe = await su.query("select 1 from pg_roles where rolname=$1", [r.usuario]);
    const verbo = existe.rowCount ? "ALTER" : "CREATE";
    await su.query(`${verbo} ROLE ${ident(r.usuario)} LOGIN PASSWORD ${literal(r.clave)} NOSUPERUSER NOBYPASSRLS NOCREATEROLE`);
    console.log(`Rol ${r.usuario}: ${existe.rowCount ? "actualizado" : "creado"}`);
  }
  const db = await su.query("select 1 from pg_database where datname=$1", [dueno.base]);
  if (!db.rowCount) {
    await su.query(`CREATE DATABASE ${ident(dueno.base)} OWNER ${ident(dueno.usuario)} ENCODING 'UTF8'`);
    console.log(`Base ${dueno.base} creada`);
  } else console.log(`Base ${dueno.base} ya existe`);
  await su.end();

  // Permisos dentro de la base: el dueño crea tablas; la app solo lee/escribe filas.
  const enBase = new Client({ connectionString: superUrl.replace(/\/[^/?]*(\?|$)/, `/${dueno.base}$1`) });
  await enBase.connect();
  await enBase.query(`ALTER SCHEMA public OWNER TO ${ident(dueno.usuario)}`);
  await enBase.query(`REVOKE CREATE ON SCHEMA public FROM PUBLIC`);
  await enBase.query(`GRANT USAGE ON SCHEMA public TO ${ident(app.usuario)}`);
  await enBase.query(`ALTER DEFAULT PRIVILEGES FOR ROLE ${ident(dueno.usuario)} IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${ident(app.usuario)}`);
  await enBase.query(`ALTER DEFAULT PRIVILEGES FOR ROLE ${ident(dueno.usuario)} IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${ident(app.usuario)}`);
  await enBase.end();
  console.log("Listo. Ahora: npm run db:migrate && npm run db:seed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
