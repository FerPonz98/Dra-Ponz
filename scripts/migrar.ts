// Aplica las migraciones de ./drizzle con el rol dueño y ajusta permisos del rol de la app.
import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";

async function main() {
  const adminUrl = process.env.DATABASE_ADMIN_URL;
  const appUrl = process.env.DATABASE_URL;
  if (!adminUrl || !appUrl) throw new Error("Faltan DATABASE_ADMIN_URL o DATABASE_URL");
  const appUser = decodeURIComponent(new URL(appUrl).username);
  const ident = `"${appUser.replace(/"/g, '""')}"`;

  const c = new Client({ connectionString: adminUrl });
  await c.connect();
  await migrate(drizzle(c), { migrationsFolder: "./drizzle" });
  await c.query(`GRANT USAGE ON SCHEMA public TO ${ident}`);
  await c.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${ident}`);
  await c.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${ident}`);
  // Las tablas de autenticación solo las usa el rol dueño (Better Auth).
  await c.query(`REVOKE ALL ON usuarios, sesiones, cuentas, verificaciones FROM ${ident}`);
  await c.end();
  console.log("Migraciones aplicadas.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
