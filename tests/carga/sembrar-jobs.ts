// Lleva las organizaciones de carga a 50.000 cuotas para medir el job de mora y recordatorios. Idempotente.
//   node scripts/con-entorno.mjs .env.test -- npx tsx tests/carga/sembrar-jobs.ts
import "dotenv/config";
import { sql } from "drizzle-orm";
import { cerrarPools, dbAdmin, withAdmin } from "@/lib/db";
import { cuotas, planesPago } from "@/modules/cobros/schema";

const META = 50_000;

async function main() {
  if (!/cobra_app_test/.test(process.env.DATABASE_URL ?? "")) throw new Error("Solo contra la base de pruebas (cobra_app_test).");
  const db = dbAdmin();
  const total = async () => Number((await db.execute<{ n: string }>(sql`select count(*) n from cuotas c join organizaciones o on o.id=c.organizacion_id where o.slug like 'carga-%'`)).rows[0].n);
  let n = await total();
  if (n >= META) return console.log(`Ya hay ${n} cuotas de carga.`);
  const orgs = (await db.execute<{ id: string }>(sql`select id from organizaciones where slug like 'carga-%' order by slug`)).rows.map((x) => x.id);
  const t0 = Date.now();
  const porOrg = Math.ceil((META - n) / orgs.length / 3); // planes de 3 cuotas
  for (const org of orgs) {
    const cls = (await db.execute<{ id: string }>(sql`select id from clientes where organizacion_id = ${org}`)).rows.map((x) => x.id);
    await withAdmin(async (tx) => {
      const pls = Array.from({ length: porOrg }, (_, i) => ({
        id: crypto.randomUUID(),
        organizacionId: org,
        clienteId: cls[i % cls.length],
        titulo: `Job carga ${i}`,
        moneda: "BOB" as const,
        aceptadoEn: new Date(),
        recargoActivo: i % 3 === 0,
        recargoPorcentaje: i % 3 === 0 ? "5.00" : null,
        recargoModo: (i % 6 === 0 ? "mensual" : "unico") as "unico",
        diasGracia: i % 4 === 0 ? null : 5,
        origen: "carga-job",
      }));
      for (let k = 0; k < pls.length; k += 500) await tx.insert(planesPago).values(pls.slice(k, k + 500));
      // Vencimientos repartidos entre julio 2026 y marzo 2027: muchas vencidas (mora y recargos), algunas hoy y en 3 días.
      const cts = pls.flatMap((p, i) =>
        [0, 1, 2].map((k) => {
          const d = new Date(Date.UTC(2026, 6, 1 + ((i * 7 + k * 31) % 270)));
          return { organizacionId: org, planId: p.id, numero: k + 1, montoCentavos: 20_000 + (i % 7) * 2_500, fechaVencimiento: d.toISOString().slice(0, 10) };
        }),
      );
      for (let k = 0; k < cts.length; k += 1000) await tx.insert(cuotas).values(cts.slice(k, k + 1000));
    });
  }
  n = await total();
  console.log(`Cuotas de carga: ${n} (${Math.round((Date.now() - t0) / 1000)} s)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => cerrarPools());
