// Borra todo el esquema public (SOLO desarrollo). Luego: db:migrate y db:seed.
import "dotenv/config";
import { Client } from "pg";

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("db:reset no se ejecuta en producción");
  const c = new Client({ connectionString: process.env.DATABASE_ADMIN_URL });
  await c.connect();
  await c.query("DROP SCHEMA IF EXISTS drizzle CASCADE");
  const { rows } = await c.query<{ tablename: string }>("select tablename from pg_tables where schemaname='public'");
  for (const r of rows) await c.query(`DROP TABLE IF EXISTS "${r.tablename}" CASCADE`);
  await c.query("DROP FUNCTION IF EXISTS aplicar_rls()");
  await c.end();
  console.log("Esquema vaciado.");
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
