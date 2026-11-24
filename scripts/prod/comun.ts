// Utilidades de los scripts de producción (migraciones, worker, seed, backup, restauración).
// Se empaquetan con esbuild en dist-prod/*.mjs (npm run build:prod) para correr en la imagen sin TypeScript.
import { spawn } from "node:child_process";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { open, stat } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { Client } from "pg";

export const urlDueno = () => {
  const u = process.env.DATABASE_URL_OWNER ?? process.env.DATABASE_ADMIN_URL; // OWNER manda si están las dos
  if (!u) throw new Error("Falta DATABASE_URL_OWNER (conexión con el rol dueño)");
  return u;
};

export const log = (msg: string, datos?: unknown) => console.log(`[${new Date().toISOString()}] ${msg}${datos === undefined ? "" : ` ${JSON.stringify(datos)}`}`);
export const aviso = (msg: string) => console.warn(`[${new Date().toISOString()}] ⚠ ${msg}`);

/** Espera a que Postgres acepte conexiones (Easypanel puede arrancar la app antes que la base). */
export async function esperarPostgres(url: string, maxSeg = 90) {
  const t0 = Date.now();
  for (let intento = 1; ; intento++) {
    const c = new Client({ connectionString: url, connectionTimeoutMillis: 5000 });
    try {
      await c.connect();
      await c.query("select 1");
      await c.end();
      if (intento > 1) log(`Postgres listo (${Math.round((Date.now() - t0) / 1000)} s)`);
      return;
    } catch (e) {
      await c.end().catch(() => undefined);
      if ((Date.now() - t0) / 1000 > maxSeg) throw new Error(`Postgres no responde después de ${maxSeg} s: ${(e as Error).message}`);
      if (intento === 1) log("Esperando a Postgres…");
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

/**
 * Ejecuta `fn` con un lock de Postgres (pg_try_advisory_lock): si otra réplica ya lo tiene, NO corre y devuelve
 * null. El lock es de sesión y se libera solo si el proceso muere.
 */
export async function conLock<T>(nombre: string, fn: () => Promise<T>): Promise<T | null> {
  const c = new Client({ connectionString: urlDueno() });
  await c.connect();
  try {
    const { rows } = await c.query<{ ok: boolean }>("select pg_try_advisory_lock(hashtext($1)) as ok", [`draponz:${nombre}`]);
    if (!rows[0].ok) {
      aviso(`"${nombre}" ya está corriendo en otra réplica: se omite esta vez`);
      return null;
    }
    try {
      return await fn();
    } finally {
      await c.query("select pg_advisory_unlock(hashtext($1))", [`draponz:${nombre}`]);
    }
  } finally {
    await c.end();
  }
}

/** Corre un programa externo (pg_dump, tar, rclone…) y falla con su salida de error si termina mal. */
export function correr(programa: string, args: string[], opciones: { env?: NodeJS.ProcessEnv; ocultar?: string[] } = {}) {
  return new Promise<void>((ok, no) => {
    const p = spawn(programa, args, { env: { ...process.env, ...opciones.env }, stdio: ["ignore", "inherit", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("error", (e) => no(new Error(`No se pudo ejecutar ${programa}: ${e.message}`)));
    p.on("close", (codigo) => {
      if (codigo === 0) return ok();
      let mensaje = err.trim().slice(-800);
      for (const s of opciones.ocultar ?? []) mensaje = mensaje.split(s).join("***");
      no(new Error(`${programa} terminó con código ${codigo}: ${mensaje}`));
    });
  });
}

// ───────── Cifrado de backups: AES-256-GCM en streaming, clave derivada con scrypt ─────────
// Formato: "DPBK1\n" (6) + sal (16) + iv (12) + datos cifrados + tag (16).
const MAGIA = Buffer.from("DPBK1\n");

function clave(secreto: string, sal: Buffer) {
  if (!secreto || secreto.length < 32) throw new Error("BACKUP_ENCRYPTION_KEY debe tener al menos 32 caracteres");
  return scryptSync(secreto, sal, 32, { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
}

export async function cifrarArchivo(origen: string, destino: string, secreto: string) {
  const sal = randomBytes(16);
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", clave(secreto, sal), iv);
  const salida = createWriteStream(destino, { mode: 0o600 });
  salida.write(Buffer.concat([MAGIA, sal, iv]));
  await pipeline(createReadStream(origen), c, salida, { end: false });
  await new Promise<void>((ok, no) => salida.end(c.getAuthTag(), (e?: Error | null) => (e ? no(e) : ok())));
}

export async function descifrarArchivo(origen: string, destino: string, secreto: string) {
  const { size } = await stat(origen);
  const f = await open(origen, "r");
  const cab = Buffer.alloc(34);
  const tag = Buffer.alloc(16);
  await f.read(cab, 0, 34, 0);
  await f.read(tag, 0, 16, size - 16);
  await f.close();
  if (!cab.subarray(0, 6).equals(MAGIA)) throw new Error(`${origen} no es un backup cifrado de esta app`);
  const d = createDecipheriv("aes-256-gcm", clave(secreto, cab.subarray(6, 22)), cab.subarray(22, 34));
  d.setAuthTag(tag);
  // Si la clave es incorrecta o el archivo fue alterado, final() falla y no se usa el resultado
  await pipeline(createReadStream(origen, { start: 34, end: size - 17 }), d, createWriteStream(destino, { mode: 0o600 }));
}
