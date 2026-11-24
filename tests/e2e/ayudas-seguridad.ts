// Datos de prueba para la auditoría de seguridad, creados con los servicios (RLS con withOrg).
import { expect, type Page } from "@playwright/test";
import { asc, eq } from "drizzle-orm";
import { cerrarPools, withOrg } from "@/lib/db";
import { generarCuotas } from "@/modules/cobros/dominio/plan";
import { cuotas } from "@/modules/cobros/schema";
import { crearCliente } from "@/modules/cobros/servicios/clientes";
import { crearEnlace } from "@/modules/cobros/servicios/enlaces";
import { crearPlan } from "@/modules/cobros/servicios/planes";
import { sqlAdmin, unico } from "./ayudas";

export { cerrarPools };

export async function idOrganizacion(slug: string) {
  const [o] = await sqlAdmin<{ id: string }>("select id from organizaciones where slug = $1", [slug]);
  return o.id;
}

/** Cliente + plan de 3 cuotas + enlace con CI en la organización indicada. */
export async function planConPortal(slug: string, nombreBase = `seguridad ${unico()}`) {
  // Prefijo "Cliente E2E ": tests/e2e/preparar.ts borra estos datos antes de cada corrida (si no, se acumulan).
  const nombre = `Cliente E2E ${nombreBase}`;
  const org = await idOrganizacion(slug);
  const ci = `8${Math.floor(1e6 + Math.random() * 8e6)}`;
  return withOrg(org, async (tx) => {
    const actor = { organizacionId: org, usuarioId: null, usuarioNombre: "e2e" };
    const c = await crearCliente(tx, org, { nombre, ci, whatsapp: "59170001234", notas: "Nota privada del cliente" });
    const p = await crearPlan(tx, actor, { clienteId: c.id, titulo: `Plan ${nombre}`, moneda: "BOB", cuotas: generarCuotas(3, 30000, "2026-01-05") });
    const cs = await tx.select({ id: cuotas.id }).from(cuotas).where(eq(cuotas.planId, p.id)).orderBy(asc(cuotas.numero));
    const e = await crearEnlace(tx, { organizacionId: org, planId: p.id, metodo: "ci" });
    return { org, ci, token: e.token, enlaceId: e.enlace.id, planId: p.id, clienteId: c.id, cuotaIds: cs.map((x) => x.id), nombre };
  });
}

/** Entra al portal con el CI (formulario real). */
export async function entrarPortal(page: Page, token: string, ci: string) {
  await page.goto(`/p/${token}`);
  await page.getByLabel("Carnet de identidad (CI)").fill(ci);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("button", { name: "Ya pagué, subir comprobante" })).toBeVisible();
}
