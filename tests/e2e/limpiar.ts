import "dotenv/config";
import { Client } from "pg";
import { borrarUsuariosDePrueba } from "./preparar";

/** Al terminar la corrida E2E: borra el superadmin y la organización Demo de prueba (quedan solo los usuarios reales). */
export default async function limpiar() {
  const c = new Client({ connectionString: process.env.DATABASE_ADMIN_URL });
  await c.connect();
  await borrarUsuariosDePrueba(c);
  await c.end();
}
