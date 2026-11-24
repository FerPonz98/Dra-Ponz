// Integridad de las subidas concurrentes del escenario del portal (BD de pruebas).
//   node scripts/con-entorno.mjs .env.test -- npx tsx tests/carga/subidas.ts verificar   → cada comprobante es el de su estudiante, completo
//   node scripts/con-entorno.mjs .env.test -- npx tsx tests/carga/subidas.ts reiniciar   → borra los comprobantes subidos por k6
import "dotenv/config";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { directorioSubidas } from "@/core/archivos";
import { cerrarPools, dbAdmin } from "@/lib/db";

type Fila = { pago_id: string; cuota_id: string; token: string | null; ruta: string; tamano: number; enlace_id: string; archivo_id: string };

async function filas() {
  return (
    await dbAdmin().execute<Fila>(sql`
      select p.id pago_id, p.cuota_id, e.token, a.ruta_relativa ruta, a.tamano_bytes tamano, p.enlace_id, a.id archivo_id
      from pagos p join archivos a on a.id = p.comprobante_archivo_id join enlaces_portal e on e.id = p.enlace_id
      join organizaciones o on o.id = p.organizacion_id
      where o.slug like 'carga-%' and p.enlace_id is not null`)
  ).rows;
}

async function main() {
  if (!/cobra_app_test/.test(process.env.DATABASE_URL ?? "")) throw new Error("Solo contra la base de pruebas (cobra_app_test).");
  const modo = process.argv[2];
  const fs = await filas();
  if (modo === "reiniciar") {
    for (const f of fs) await rm(join(directorioSubidas(), f.ruta), { force: true });
    await dbAdmin().execute(sql`delete from pagos where id in (select p.id from pagos p join organizaciones o on o.id = p.organizacion_id where o.slug like 'carga-%' and p.enlace_id is not null)`);
    if (fs.length) await dbAdmin().execute(sql`delete from archivos where id in (${sql.join(fs.map((f) => sql`${f.archivo_id}::uuid`), sql`, `)})`);
    console.log(`Reiniciado: ${fs.length} comprobantes de k6 borrados.`);
    return;
  }
  let ok = 0;
  const malos: string[] = [];
  const porCuota = new Map<string, number>();
  for (const f of fs) {
    porCuota.set(f.cuota_id, (porCuota.get(f.cuota_id) ?? 0) + 1);
    const b = await readFile(join(directorioSubidas(), f.ruta)).catch(() => null);
    if (!b) {
      malos.push(`${f.pago_id}: falta el archivo`);
      continue;
    }
    const cab = b.subarray(0, 200).toString("latin1");
    const m = /%MARCA:([^:]+):([0-9a-f-]{36}):(\d+)/.exec(cab);
    if (!m) malos.push(`${f.pago_id}: sin marca`);
    else if (m[1] !== f.token) malos.push(`${f.pago_id}: archivo de OTRO estudiante (${m[1].slice(0, 8)}…)`);
    else if (m[2] !== f.cuota_id) malos.push(`${f.pago_id}: archivo de otra cuota`);
    else if (Number(m[3]) !== b.byteLength || b.byteLength !== Number(f.tamano)) malos.push(`${f.pago_id}: tamaño ${b.byteLength} ≠ ${m[3]} (corrupto o truncado)`);
    else ok++;
  }
  const duplicados = [...porCuota.values()].filter((n) => n > 1).length;
  const r = { subidas: fs.length, integras: ok, problemas: malos.length, cuotasConMasDeUnPago: duplicados };
  console.log(r);
  for (const x of malos.slice(0, 20)) console.log("  ✗", x);
  if (malos.length || duplicados) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => cerrarPools());
