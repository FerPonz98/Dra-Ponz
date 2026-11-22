import { sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

type Global = typeof globalThis & { __poolApp?: Pool; __poolAdmin?: Pool };
const g = globalThis as Global;

function crearPool(url: string | undefined, nombre: string) {
  if (!url) throw new Error(`Falta la variable ${nombre}`);
  return new Pool({ connectionString: url, max: 10, idleTimeoutMillis: 30_000 });
}

/** Pool con el rol de la app (sin BYPASSRLS): toda consulta de negocio pasa por aquí. */
export function poolApp() {
  g.__poolApp ??= crearPool(process.env.DATABASE_URL, "DATABASE_URL");
  return g.__poolApp;
}
/** Pool con el rol dueño (omite RLS): solo auth, superadmin, jobs y resolución de tokens del portal. */
export function poolAdmin() {
  g.__poolAdmin ??= crearPool(process.env.DATABASE_ADMIN_URL, "DATABASE_ADMIN_URL");
  return g.__poolAdmin;
}

export type Db = NodePgDatabase<Record<string, never>>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
/** Cualquier ejecutor: conexión o transacción. */
export type Ejecutor = Db | Tx;

let _dbApp: Db | undefined;
let _dbAdmin: Db | undefined;
export const dbApp = () => (_dbApp ??= drizzle(poolApp()));
export const dbAdmin = () => (_dbAdmin ??= drizzle(poolAdmin()));

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Ejecuta `fn` en una transacción del rol de la app con `app.organizacion_id` fijado (SET LOCAL).
 * Las políticas RLS filtran todas las tablas de negocio por ese valor.
 */
export async function withOrg<T>(organizacionId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  if (!UUID.test(organizacionId)) throw new Error("organizacion_id inválido");
  return dbApp().transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.organizacion_id', ${organizacionId}, true)`);
    return fn(tx);
  });
}

/** Transacción con el rol dueño (sin RLS). Úsalo solo en código de sistema. */
export async function withAdmin<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return dbAdmin().transaction(fn);
}

export async function cerrarPools() {
  await Promise.all([g.__poolApp?.end(), g.__poolAdmin?.end()]);
  g.__poolApp = undefined;
  g.__poolAdmin = undefined;
  _dbApp = undefined;
  _dbAdmin = undefined;
}
