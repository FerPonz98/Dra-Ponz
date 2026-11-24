// Worker de crons (servicio aparte en Easypanel, mismo Dockerfile, comando: npm run worker).
// Zona America/La_Paz: mora + recordatorios + estados de Tesis 07:00 · tipo de cambio BCB 08:00 · backup 02:00.
// Cada job corre con un lock de Postgres (pg_try_advisory_lock): aunque haya varias réplicas, nunca dos a la vez.
// Los jobs ya son idempotentes (no duplican recargos, recordatorios ni cotizaciones si se repiten el mismo día).
//   npm run worker                          → queda corriendo con los horarios
//   npm run worker -- --una-vez mora        → corre un job ahora y termina (mora | tipo-cambio | backup | todos)
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import cron from "node-cron";
import { jobTesisDiario } from "@/app/panel/sincronizar";
import { cerrarPools } from "@/lib/db";
import { validarEntorno } from "@/lib/entorno";
import { jobMoraYRecordatorios, jobTipoCambio } from "@/modules/cobros/servicios/jobs";
import { hacerBackup } from "./backup";
import { aviso, conLock, esperarPostgres, log, urlDueno } from "./comun";

const ZONA = "America/La_Paz";
export const LATIDO = join(tmpdir(), "worker-latido");

const JOBS = {
  mora: {
    cuando: "0 7 * * *",
    correr: async () => {
      const ahora = new Date();
      const cobros = await jobMoraYRecordatorios(ahora);
      const tesis = await jobTesisDiario(ahora);
      return { organizaciones: cobros.length, planes: cobros.reduce((s, x) => s + x.planes, 0), recargos: cobros.reduce((s, x) => s + x.recargos, 0), correos: cobros.reduce((s, x) => s + x.correos, 0), tesis };
    },
  },
  "tipo-cambio": { cuando: "0 8 * * *", correr: () => jobTipoCambio() },
  backup: { cuando: "0 2 * * *", correr: () => hacerBackup() },
} as const;
type NombreJob = keyof typeof JOBS;

async function ejecutar(nombre: NombreJob) {
  const t0 = Date.now();
  log(`▶ ${nombre}`);
  try {
    const job: () => Promise<unknown> = JOBS[nombre].correr;
    const r = await conLock(nombre, job);
    if (r !== null) log(`✓ ${nombre} (${((Date.now() - t0) / 1000).toFixed(1)} s)`, r);
    return true;
  } catch (e) {
    console.error(`[${new Date().toISOString()}] ✗ ${nombre}: ${(e as Error).message}`);
    return false;
  }
}

async function main() {
  validarEntorno("worker");
  await esperarPostgres(urlDueno());
  const i = process.argv.indexOf("--una-vez");
  if (i > 0) {
    const pedido = process.argv[i + 1] ?? "todos";
    const lista = (pedido === "todos" ? Object.keys(JOBS) : [pedido]) as NombreJob[];
    if (lista.some((n) => !(n in JOBS))) throw new Error(`Job desconocido: ${pedido}. Usa: ${Object.keys(JOBS).join(", ")} o todos`);
    let ok = true;
    for (const n of lista) ok = (await ejecutar(n)) && ok;
    await cerrarPools();
    process.exit(ok ? 0 : 1);
  }

  if (!process.env.RCLONE_REMOTE) aviso("RCLONE_REMOTE vacío: los backups quedarán solo en este servidor.");
  const tareas = (Object.keys(JOBS) as NombreJob[]).map((n) => cron.schedule(JOBS[n].cuando, () => void ejecutar(n), { timezone: ZONA, name: n, noOverlap: true }));
  log(`Worker listo (${ZONA}): mora y recordatorios 07:00 · tipo de cambio 08:00 · backup 02:00`);

  // Latido para el HEALTHCHECK del contenedor (dist-prod/salud.mjs)
  const latir = () => writeFileSync(LATIDO, String(Date.now()));
  latir();
  const latido = setInterval(latir, 30_000);

  const salir = async (senal: string) => {
    log(`Recibí ${senal}: cerrando el worker`);
    clearInterval(latido);
    for (const t of tareas) await t.stop();
    await cerrarPools();
    process.exit(0);
  };
  process.on("SIGTERM", () => void salir("SIGTERM"));
  process.on("SIGINT", () => void salir("SIGINT"));
}

main().catch((e) => {
  console.error(`✗ ${(e as Error).message}`);
  process.exit(1);
});
