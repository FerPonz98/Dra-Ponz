// Crea un cliente + plan + enlace de portal con CI en la BD de PRUEBAS para escaneos (ZAP) y pruebas de carga.
// Uso: node scripts/con-entorno.mjs .env.test -- npx tsx scripts/auditoria/fixture-portal.ts
import "dotenv/config";
import { sql } from "drizzle-orm";
import { cerrarPools, dbAdmin, withOrg } from "@/lib/db";
import { generarCuotas } from "@/modules/cobros/dominio/plan";
import { firmarSesionPortal, nombreCookiePortal } from "@/modules/cobros/dominio/portal";
import { crearCliente } from "@/modules/cobros/servicios/clientes";
import { crearEnlace } from "@/modules/cobros/servicios/enlaces";
import { crearPlan } from "@/modules/cobros/servicios/planes";

async function main() {
  if (!/cobra_app_test/.test(process.env.DATABASE_URL ?? "")) throw new Error("Solo contra la base de pruebas (cobra_app_test).");
  const org = (await dbAdmin().execute<{ id: string }>(sql`select id from organizaciones where slug = 'dra-ponz'`)).rows[0].id;
  const ci = String(5_000_000 + Math.floor(Math.random() * 1e6));
  const r = await withOrg(org, async (tx) => {
    const c = await crearCliente(tx, org, { nombre: "Cliente auditoría", ci });
    const p = await crearPlan(tx, { organizacionId: org, usuarioId: null, usuarioNombre: "auditoria" }, { clienteId: c.id, titulo: "Plan auditoría", moneda: "BOB", cuotas: generarCuotas(2, 20000, "2026-12-01") });
    return crearEnlace(tx, { organizacionId: org, planId: p.id, metodo: "ci" });
  });
  // Cookie de sesión del portal ya validada (como si hubiera ingresado el CI), para escanear el portal por dentro.
  const cookie = `${nombreCookiePortal(r.enlace.id)}=${firmarSesionPortal(r.enlace.id)}`;
  console.log(JSON.stringify({ token: r.token, ci, cookie }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => cerrarPools());
