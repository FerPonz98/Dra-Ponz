// Auditoría de accesibilidad WCAG 2.1 AA (axe) de las pantallas principales, en modo claro y oscuro.
// Uso: npm run accesibilidad  (servidor corriendo en E2E_PORT o 3100). Falla si hay violaciones serias o críticas.
import "dotenv/config";
import AxeBuilder from "@axe-core/playwright";
import { chromium, type Page } from "@playwright/test";
import { Client } from "pg";

const base = `http://localhost:${process.env.E2E_PORT ?? 3100}`;

async function login(page: Page) {
  await page.goto(`${base}/login`);
  await page.getByLabel("Correo").fill(process.env.DRA_EMAIL!);
  await page.getByLabel("Contraseña").fill(process.env.DRA_PASSWORD!);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL(/\/panel/);
}

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_ADMIN_URL });
  await c.connect();
  const uno = async (q: string) => (await c.query(q)).rows[0] as Record<string, string> | undefined;
  const plan = await uno("select p.id from planes_pago p join organizaciones o on o.id=p.organizacion_id where o.slug='dra-ponz' order by p.creado_en desc limit 1");
  const prop = await uno("select id from propuestas order by (aceptada_en is not null) desc, creado_en desc limit 1");
  const portal = await uno("select e.token, cl.ci from enlaces_portal e join propuestas pr on pr.id=e.referencia_id join clientes cl on cl.id=pr.cliente_id where e.token is not null and e.metodo='ci' and pr.aceptada_en is not null order by e.creado_en desc limit 1");
  await c.end();

  const rutasPanel = ["/panel", "/panel/cobros/clientes", "/panel/cobros/planes", "/panel/cobros/recordatorios", "/panel/cobros/pagos", "/panel/tesis/propuestas", "/panel/tesis/propuestas/nueva", "/panel/tesis/calendario", "/panel/configuracion", "/panel/usuarios", ...(plan ? [`/panel/cobros/planes/${plan.id}`] : []), ...(prop ? [`/panel/tesis/propuestas/${prop.id}`] : [])];
  const nav = await chromium.launch();
  let graves = 0;
  const revisar = async (page: Page, nombre: string) => {
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const malas = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    graves += malas.length;
    console.log(`${malas.length ? "✗" : "✓"} ${nombre}${malas.length ? "" : ` (${r.violations.length} menores)`}`);
    for (const v of malas) console.log(`   - [${v.impact}] ${v.id}: ${v.help} → ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
  };

  for (const tema of ["claro", "oscuro"] as const) {
    const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.addCookies([{ name: "tema", value: tema, url: base }]);
    const page = await ctx.newPage();
    await page.goto(`${base}/login`);
    await revisar(page, `[${tema}] /login`);
    await login(page);
    for (const r of rutasPanel) {
      await page.goto(`${base}${r}`);
      await page.waitForTimeout(300);
      await revisar(page, `[${tema}] ${r}`);
    }
    await ctx.close();
  }
  // Con movimiento reducido no hay animación de aparición (axe mediría elementos aún transparentes).
  const ctx = await nav.newContext({ viewport: { width: 375, height: 812 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  for (const r of ["/es", "/pt"]) {
    await page.goto(`${base}${r}`);
    await revisar(page, `[celular] ${r}`);
  }
  if (portal) {
    await page.goto(`${base}/p/${portal.token}`);
    await revisar(page, "[celular] portal (acceso)");
    await page.getByLabel(/Carnet/).fill(portal.ci);
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.waitForTimeout(800);
    await revisar(page, "[celular] portal del estudiante");
  }
  await nav.close();
  if (graves) {
    console.error(`✗ ${graves} violaciones serias o críticas`);
    process.exit(1);
  }
  console.log("✓ Sin violaciones serias ni críticas (WCAG 2.1 AA)");
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
