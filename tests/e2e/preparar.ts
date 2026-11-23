import "dotenv/config";
import { Client } from "pg";

/** Antes de cada corrida E2E: borra los datos de prueba de corridas anteriores (por nombre). */
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
  await c.end();
}
