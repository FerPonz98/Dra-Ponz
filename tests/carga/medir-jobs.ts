// Escenario 5 — mide el job de mora + recordatorios con 50.000 cuotas y comprueba que no duplica recargos.
//   node scripts/con-entorno.mjs .env.test -- npx tsx tests/carga/medir-jobs.ts <etiqueta>
// Reinicia antes el estado de mora de las organizaciones de carga para que "antes" y "después" sean comparables.
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { cerrarPools, dbAdmin } from "@/lib/db";
import { jobMoraYRecordatorios } from "@/modules/cobros/servicios/jobs";

const etiqueta = process.argv[2] ?? "prueba";
const AHORA = new Date("2026-11-23T11:00:00Z"); // 07:00 en La Paz

async function contar() {
  const r = await dbAdmin().execute<Record<string, string>>(sql`
    select (select count(*) from cuotas c join organizaciones o on o.id=c.organizacion_id where o.slug like 'carga-%') cuotas,
           (select count(*) from recargos r join organizaciones o on o.id=r.organizacion_id where o.slug like 'carga-%') recargos,
           (select count(*) from recordatorios_enviados r join organizaciones o on o.id=r.organizacion_id where o.slug like 'carga-%') recordatorios,
           (select count(*) from (select cuota_id, numero from recargos group by 1, 2 having count(*) > 1) x) recargos_duplicados,
           (select count(*) from (select cuota_id, tipo from recordatorios_enviados group by 1, 2 having count(*) > 1) x) recordatorios_duplicados,
           (select count(*) from planes_pago p join organizaciones o on o.id=p.organizacion_id where o.slug like 'carga-%' and p.estado_mora <> 'al_dia') planes_en_mora`);
  return Object.fromEntries(Object.entries(r.rows[0]).map(([k, v]) => [k, Number(v)]));
}

async function main() {
  if (!/cobra_app_test/.test(process.env.DATABASE_URL ?? "")) throw new Error("Solo contra la base de pruebas (cobra_app_test).");
  const db = dbAdmin();
  await db.execute(sql`delete from recargos where organizacion_id in (select id from organizaciones where slug like 'carga-%')`);
  await db.execute(sql`delete from recordatorios_enviados where organizacion_id in (select id from organizaciones where slug like 'carga-%')`);
  await db.execute(sql`update planes_pago set estado_mora = 'al_dia', numero_moras = 0 where organizacion_id in (select id from organizaciones where slug like 'carga-%')`);
  const antes = await contar();
  const t1 = performance.now();
  const r1 = await jobMoraYRecordatorios(AHORA);
  const seg1 = (performance.now() - t1) / 1000;
  const tras1 = await contar();
  const t2 = performance.now();
  await jobMoraYRecordatorios(AHORA); // segunda corrida el mismo día: no debe agregar nada
  const seg2 = (performance.now() - t2) / 1000;
  const tras2 = await contar();
  const res = {
    etiqueta,
    cuotas: antes.cuotas,
    organizaciones: r1.length,
    planesProcesados: r1.reduce((s, x) => s + x.planes, 0),
    primeraCorridaSeg: Number(seg1.toFixed(1)),
    segundaCorridaSeg: Number(seg2.toFixed(1)),
    recargosCreados: tras1.recargos,
    recordatoriosEnviados: tras1.recordatorios,
    planesEnMora: tras1.planes_en_mora,
    segundaCorridaAgregóRecargos: tras2.recargos - tras1.recargos,
    segundaCorridaAgregóRecordatorios: tras2.recordatorios - tras1.recordatorios,
    recargosDuplicados: tras2.recargos_duplicados,
    recordatoriosDuplicados: tras2.recordatorios_duplicados,
    meta: "< 60 s y sin duplicados",
  };
  mkdirSync(".data/carga/resultados", { recursive: true });
  writeFileSync(`.data/carga/resultados/jobs-${etiqueta}.json`, JSON.stringify(res, null, 2));
  console.log(res);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => cerrarPools());
