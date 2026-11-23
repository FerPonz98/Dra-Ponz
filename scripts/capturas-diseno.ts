// Capturas de TODAS las pantallas en escritorio (1440) y celular (375).
// Uso: npm run capturas:diseno -- revisiones/diseno-antes   (servidor corriendo en E2E_PORT o 3100)
import "dotenv/config";
import { mkdirSync } from "node:fs";
import { chromium, type Browser, type Page } from "@playwright/test";
import { Client } from "pg";

const base = `http://localhost:${process.env.E2E_PORT ?? 3100}`;
const carpeta = process.argv[2] ?? "revisiones/diseno";
const soloAncho = process.argv[3]; // opcional: "1440" o "375"
const filtro = process.argv[4]; // opcional: subcadena del nombre

type Quien = "superadmin" | "dra" | "demo";
type Pantalla = { nombre: string; ruta: string; quien?: Quien; portal?: { token: string; ci: string }; antes?: (p: Page) => Promise<void> };

const cred: Record<Quien, [string, string]> = {
  superadmin: [process.env.SUPERADMIN_EMAIL!, process.env.SUPERADMIN_PASSWORD!],
  dra: [process.env.DRA_EMAIL!, process.env.DRA_PASSWORD!],
  demo: [process.env.DEMO_EMAIL!, process.env.DEMO_PASSWORD!],
};

async function datos() {
  const c = new Client({ connectionString: process.env.DATABASE_ADMIN_URL });
  await c.connect();
  const uno = async (q: string) => (await c.query(q)).rows[0] as Record<string, string> | undefined;
  const r = {
    cliente: await uno("select c.id from clientes c join organizaciones o on o.id=c.organizacion_id where o.slug='dra-ponz' order by c.creado_en desc limit 1"),
    plan: await uno("select p.id from planes_pago p join organizaciones o on o.id=p.organizacion_id where o.slug='dra-ponz' and p.origen is null order by p.creado_en desc limit 1"),
    propuesta: await uno("select id from propuestas order by (aceptada_en is not null) desc, creado_en desc limit 1"),
    borrador: await uno("select id from propuestas where aceptada_en is null and estado in ('borrador','enviada','vencida') order by creado_en desc limit 1"),
    formulario: await uno("select f.id from formularios f join organizaciones o on o.id=f.organizacion_id where o.slug='dra-ponz' order by f.creado_en desc limit 1"),
    portalCobros: await uno("select e.token, cl.ci from enlaces_portal e join planes_pago p on p.id=e.plan_id join clientes cl on cl.id=p.cliente_id where e.token is not null and e.metodo='ci' and e.referencia_tipo is null order by e.creado_en desc limit 1"),
    portalTesis: await uno("select e.token, cl.ci from enlaces_portal e join propuestas pr on pr.id=e.referencia_id join clientes cl on cl.id=pr.cliente_id where e.token is not null and e.metodo='ci' and pr.aceptada_en is not null order by e.creado_en desc limit 1"),
    portalPropuesta: await uno("select e.token, cl.ci from enlaces_portal e join propuestas pr on pr.id=e.referencia_id join clientes cl on cl.id=pr.cliente_id where e.token is not null and e.metodo='ci' and pr.aceptada_en is null order by e.creado_en desc limit 1"),
  };
  await c.end();
  return r;
}

async function login(page: Page, quien: Quien) {
  await page.goto(`${base}/login`);
  await page.getByLabel("Correo").fill(cred[quien][0]);
  await page.getByLabel("Contraseña").fill(cred[quien][1]);
  await page.getByRole("button", { name: /Ingresar|Iniciar sesión/ }).click();
  await page.waitForURL(/\/(panel|superadmin)/);
}

async function main() {
  const d = await datos();
  const pantallas: Pantalla[] = [
    { nombre: "01-login", ruta: "/login" },
    { nombre: "02-recuperar", ruta: "/recuperar" },
    { nombre: "03-landing-es", ruta: "/es" },
    { nombre: "04-landing-pt", ruta: "/pt" },
    { nombre: "05-portal-acceso", ruta: d.portalCobros ? `/p/${d.portalCobros.token}` : "/login" },
    { nombre: "06-portal-no-disponible", ruta: "/p/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" },
    ...(d.portalCobros ? [{ nombre: "07-portal-cobros", ruta: `/p/${d.portalCobros.token}`, portal: { token: d.portalCobros.token, ci: d.portalCobros.ci } }] : []),
    ...(d.portalPropuesta ? [{ nombre: "08-portal-propuesta", ruta: `/p/${d.portalPropuesta.token}`, portal: { token: d.portalPropuesta.token, ci: d.portalPropuesta.ci } }] : []),
    ...(d.portalTesis ? [{ nombre: "09-portal-estudiante", ruta: `/p/${d.portalTesis.token}`, portal: { token: d.portalTesis.token, ci: d.portalTesis.ci } }] : []),
    { nombre: "10-inicio", ruta: "/panel", quien: "dra" },
    { nombre: "11-clientes", ruta: "/panel/cobros/clientes", quien: "dra" },
    ...(d.cliente ? [{ nombre: "12-cliente-ficha", ruta: `/panel/cobros/clientes/${d.cliente.id}`, quien: "dra" as const }] : []),
    { nombre: "13-planes", ruta: "/panel/cobros/planes", quien: "dra" },
    { nombre: "14-plan-nuevo", ruta: "/panel/cobros/planes/nuevo", quien: "dra" },
    ...(d.plan ? [{ nombre: "15-plan-detalle", ruta: `/panel/cobros/planes/${d.plan.id}`, quien: "dra" as const }] : []),
    { nombre: "16-comprobantes", ruta: "/panel/cobros/pagos", quien: "dra" },
    { nombre: "17-recordatorios", ruta: "/panel/cobros/recordatorios", quien: "dra" },
    { nombre: "18-plantillas", ruta: "/panel/cobros/plantillas", quien: "dra" },
    { nombre: "19-propuestas", ruta: "/panel/tesis/propuestas", quien: "dra" },
    { nombre: "20-propuesta-nueva", ruta: "/panel/tesis/propuestas/nueva", quien: "dra" },
    ...(d.propuesta ? [{ nombre: "21-proyecto-ficha", ruta: `/panel/tesis/propuestas/${d.propuesta.id}`, quien: "dra" as const }] : []),
    ...(d.borrador ? [{ nombre: "22-propuesta-ficha-enviada", ruta: `/panel/tesis/propuestas/${d.borrador.id}`, quien: "dra" as const }] : []),
    { nombre: "23-formularios", ruta: "/panel/tesis/formularios", quien: "dra" },
    ...(d.formulario ? [{ nombre: "24-formulario-editor", ruta: `/panel/tesis/formularios/${d.formulario.id}`, quien: "dra" as const }] : []),
    { nombre: "25-calendario", ruta: "/panel/tesis/calendario", quien: "dra" },
    { nombre: "26-landing-editor", ruta: "/panel/tesis/landing", quien: "dra" },
    { nombre: "27-organizacion", ruta: "/panel/configuracion", quien: "dra" },
    { nombre: "28-usuarios", ruta: "/panel/usuarios", quien: "dra" },
    { nombre: "29-superadmin", ruta: "/superadmin", quien: "superadmin" },
    { nombre: "30-inicio-demo", ruta: "/panel", quien: "demo" },
  ];

  mkdirSync(carpeta, { recursive: true });
  const nav: Browser = await chromium.launch();
  const anchos = ([[1440, 900, "escritorio"], [375, 812, "celular"]] as const).filter(([w]) => !soloAncho || String(w) === soloAncho);
  for (const [ancho, alto, sufijo] of anchos) {
    const sesiones = new Map<string, Page>();
    for (const p of pantallas) {
      if (filtro && !p.nombre.includes(filtro)) continue;
      const clave = p.quien ?? (p.portal ? `portal-${p.portal.token}` : "anon");
      let page = sesiones.get(clave);
      if (!page) {
        const ctx = await nav.newContext({ viewport: { width: ancho, height: alto }, locale: "es-BO", timezoneId: "America/La_Paz", reducedMotion: "reduce" });
        if (process.env.TEMA === "oscuro") await ctx.addCookies([{ name: "tema", value: "oscuro", url: base }]);
        page = await ctx.newPage();
        if (p.quien) await login(page, p.quien);
        if (p.portal) {
          await page.goto(`${base}/p/${p.portal.token}`);
          await page.getByLabel(/Carnet de identidad|CI/).first().fill(p.portal.ci);
          await page.getByRole("button", { name: /Entrar|Ingresar|Continuar/ }).click();
          await page.waitForTimeout(800);
        }
        sesiones.set(clave, page);
      }
      await page.goto(`${base}${p.ruta}`, { waitUntil: "load" });
      if (p.antes) await p.antes(page);
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${carpeta}/${p.nombre}-${sufijo}.png`, fullPage: true });
      console.log(`✓ ${carpeta}/${p.nombre}-${sufijo}.png`);
    }
  }
  await nav.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
