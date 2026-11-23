// Capturas de revisión manual: npm run capturas -- <fase>  (servidor corriendo en E2E_PORT o 3100)
import "dotenv/config";
import { mkdirSync } from "node:fs";
import { chromium, type Page } from "@playwright/test";

const base = `http://localhost:${process.env.E2E_PORT ?? 3100}`;
const fase = process.argv[2] ?? "0";

type Pagina = { nombre: string; ruta: string | (() => Promise<string>); quien?: "superadmin" | "dra" | "demo" | null };

const extra: Record<string, string> = {};

async function cargarExtras() {
  const { Client } = await import("pg");
  const c = new Client({ connectionString: process.env.DATABASE_ADMIN_URL });
  await c.connect();
  const uno = async (q: string) => (await c.query(q).catch(() => ({ rows: [] as Record<string, string>[] }))).rows[0] as Record<string, string> | undefined;
  const plan = await uno("select p.id from planes_pago p join organizaciones o on o.id=p.organizacion_id where o.slug='dra-ponz' order by p.creado_en desc limit 1");
  if (plan) extra.plan = `/panel/cobros/planes/${plan.id}`;
  const enlace = await uno("select token from enlaces_portal where token is not null order by creado_en desc limit 1");
  if (enlace) extra.portal = `/p/${enlace.token}`;
  const prop = await uno("select id from propuestas order by creado_en desc limit 1");
  if (prop) extra.propuesta = `/panel/tesis/propuestas/${prop.id}`;
  await c.end();
}

const PAGINAS: Record<string, Pagina[]> = {
  "0": [
    { nombre: "login", ruta: "/login", quien: null },
    { nombre: "superadmin", ruta: "/superadmin", quien: "superadmin" },
    { nombre: "panel-dra", ruta: "/panel", quien: "dra" },
  ],
  "1": [
    { nombre: "clientes", ruta: "/panel/cobros/clientes", quien: "dra" },
    { nombre: "planes", ruta: "/panel/cobros/planes", quien: "dra" },
    { nombre: "plan-detalle", ruta: async () => extra.plan ?? "/panel/cobros/planes", quien: "dra" },
    { nombre: "comprobantes", ruta: "/panel/cobros/pagos", quien: "dra" },
    { nombre: "portal-acceso", ruta: async () => extra.portal ?? "/login", quien: null },
  ],
  "2": [
    { nombre: "resumen", ruta: "/panel", quien: "dra" },
    { nombre: "recordatorios", ruta: "/panel/cobros/recordatorios", quien: "dra" },
    { nombre: "plantillas", ruta: "/panel/cobros/plantillas", quien: "dra" },
  ],
  "3": [
    { nombre: "propuestas", ruta: "/panel/tesis/propuestas", quien: "dra" },
    { nombre: "propuesta-nueva", ruta: "/panel/tesis/propuestas/nueva", quien: "dra" },
    { nombre: "propuesta-ficha", ruta: async () => extra.propuesta ?? "/panel/tesis/propuestas", quien: "dra" },
  ],
  "4": [
    { nombre: "formularios", ruta: "/panel/tesis/formularios", quien: "dra" },
    { nombre: "calendario", ruta: "/panel/tesis/calendario", quien: "dra" },
    { nombre: "portal-estudiante", ruta: async () => extra.portal ?? "/login", quien: null },
  ],
  "5": [
    { nombre: "landing-es", ruta: "/es", quien: null },
    { nombre: "landing-pt", ruta: "/pt", quien: null },
    { nombre: "editor-landing", ruta: "/panel/tesis/landing", quien: "dra" },
  ],
};

const cred = {
  superadmin: [process.env.SUPERADMIN_EMAIL!, process.env.SUPERADMIN_PASSWORD!],
  dra: [process.env.DRA_EMAIL!, process.env.DRA_PASSWORD!],
  demo: [process.env.DEMO_EMAIL!, process.env.DEMO_PASSWORD!],
} as const;

async function login(page: Page, quien: keyof typeof cred) {
  await page.goto(`${base}/login`);
  await page.getByLabel("Correo").fill(cred[quien][0]);
  await page.getByLabel("Contraseña").fill(cred[quien][1]);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL(/\/(panel|superadmin)/);
}

async function main() {
  await cargarExtras();
  const dir = `revisiones/fase-${fase}`;
  mkdirSync(dir, { recursive: true });
  const nav = await chromium.launch();
  for (const [ancho, alto, sufijo] of [
    [1280, 900, "escritorio"],
    [375, 812, "movil"],
  ] as const) {
    const sesiones = new Map<string, Page>();
    for (const p of PAGINAS[fase] ?? []) {
      const clave = p.quien ?? "anonimo";
      let page = sesiones.get(clave);
      if (!page) {
        const ctx = await nav.newContext({ viewport: { width: ancho, height: alto }, locale: "es-BO" });
        page = await ctx.newPage();
        if (p.quien) await login(page, p.quien);
        sesiones.set(clave, page);
      }
      const ruta = typeof p.ruta === "string" ? p.ruta : await p.ruta();
      await page.goto(`${base}${ruta}`, { waitUntil: "load" });
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${dir}/${p.nombre}-${sufijo}.png`, fullPage: true });
      console.log(`✓ ${dir}/${p.nombre}-${sufijo}.png`);
    }
  }
  await nav.close();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
