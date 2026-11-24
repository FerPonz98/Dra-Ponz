// Video de la intro (escritorio y celular) y capturas de la marca nueva en landing, login, panel, portal, PDF e imagen OG.
//   npm run capturas:marca   (servidor corriendo en E2E_PORT o 3100, base de desarrollo con datos del seed/E2E)
import "dotenv/config";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium, type Page } from "@playwright/test";
import { Client } from "pg";

const base = `http://localhost:${process.env.E2E_PORT ?? 3100}`;
const intro = join("revisiones", "intro");
const marca = join("revisiones", "marca");
mkdirSync(intro, { recursive: true });
mkdirSync(marca, { recursive: true });

async function login(page: Page) {
  await page.goto(`${base}/login`);
  await page.getByLabel("Correo").fill(process.env.DRA_EMAIL!);
  await page.getByLabel("Contraseña").fill(process.env.DRA_PASSWORD!);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL(/\/panel/);
}

async function main() {
  const nav = await chromium.launch();

  // 1) Video de la intro (primera visita de la sesión)
  for (const [nombre, viewport, movil] of [
    ["intro-escritorio", { width: 1440, height: 900 }, false],
    ["intro-celular", { width: 390, height: 844 }, true],
  ] as const) {
    const ctx = await nav.newContext({ viewport, isMobile: movil, hasTouch: movil, recordVideo: { dir: intro, size: viewport } });
    const p = await ctx.newPage();
    await p.goto(`${base}/es`);
    await p.waitForTimeout(3200);
    const v = p.video();
    await ctx.close();
    renameSync(await v!.path(), join(intro, `${nombre}.webm`));
    console.log(`✓ ${nombre}.webm`);
  }

  // 2) Capturas con el logo nuevo (sin intro)
  const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => sessionStorage.setItem("jp-intro", "1"));
  const p = await ctx.newPage();
  await p.goto(`${base}/es`);
  await p.waitForTimeout(800);
  await p.screenshot({ path: join(marca, "1-landing-escritorio.png") });
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await p.waitForTimeout(800);
  await p.screenshot({ path: join(marca, "2-landing-pie.png") });
  const cel = await nav.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  await cel.addInitScript(() => sessionStorage.setItem("jp-intro", "1"));
  const pc = await cel.newPage();
  await pc.goto(`${base}/es`);
  await pc.waitForTimeout(800);
  await pc.screenshot({ path: join(marca, "3-landing-celular.png") });
  await pc.goto(`${base}/login`);
  await pc.screenshot({ path: join(marca, "5-login-celular.png") });
  await p.goto(`${base}/login`);
  await p.screenshot({ path: join(marca, "4-login.png") });
  await login(p);
  await p.screenshot({ path: join(marca, "6-panel.png") });

  // Portal: un enlace con CI de la base (como scripts/accesibilidad.ts)
  const c = new Client({ connectionString: process.env.DATABASE_ADMIN_URL });
  await c.connect();
  const [enlace] = (await c.query("select e.token, cl.ci from enlaces_portal e join planes_pago p on p.id=e.plan_id join clientes cl on cl.id=p.cliente_id join organizaciones o on o.id=e.organizacion_id where o.slug='dra-ponz' and e.token is not null and e.metodo='ci' and e.anulado_en is null and (e.expira_en is null or e.expira_en > now()) order by e.creado_en desc limit 1")).rows;
  const [prop] = (await c.query("select p.id from propuestas p join organizaciones o on o.id=p.organizacion_id where o.slug='dra-ponz' order by p.creado_en desc limit 1")).rows;
  await c.end();
  if (enlace) {
    await pc.goto(`${base}/p/${enlace.token}`);
    await pc.getByLabel(/Carnet/).fill(enlace.ci);
    await pc.getByRole("button", { name: "Entrar" }).click();
    await pc.waitForTimeout(1200);
    await pc.screenshot({ path: join(marca, "7-portal-celular.png") });
  }

  // PDF de la propuesta: se renderiza la primera página con pdf.js en el navegador
  if (prop) {
    const pdf = await (await p.request.get(`${base}/api/tesis/propuestas/${prop.id}/pdf`)).body();
    writeFileSync(join(marca, "8-propuesta.pdf"), pdf);
    const pdfjs = resolve("node_modules/pdfjs-dist/build");
    const pv = await nav.newPage({ viewport: { width: 900, height: 1200 }, deviceScaleFactor: 1.5 });
    await pv.route("https://pdfjs.local/**", (r) => r.fulfill({ body: readFileSync(join(pdfjs, new URL(r.request().url()).pathname.slice(1))), contentType: "text/javascript" }));
    await pv.route("https://pagina.local/", (r) => r.fulfill({ contentType: "text/html", body: "<body style=margin:0;background:#e5e5e5><canvas id=c></canvas></body>" }));
    await pv.goto("https://pagina.local/");
    await pv.evaluate(async (b64) => {
      const lib = await import("https://pdfjs.local/pdf.min.mjs" as string);
      lib.GlobalWorkerOptions.workerSrc = "https://pdfjs.local/pdf.worker.min.mjs";
      const doc = await lib.getDocument({ data: Uint8Array.from(atob(b64), (x) => x.charCodeAt(0)) }).promise;
      const pag = await doc.getPage(1);
      const vp = pag.getViewport({ scale: 1.4 });
      const cv = document.getElementById("c") as HTMLCanvasElement;
      cv.width = vp.width;
      cv.height = vp.height;
      await pag.render({ canvasContext: cv.getContext("2d")!, viewport: vp, canvas: cv }).promise;
    }, pdf.toString("base64"));
    await pv.locator("#c").screenshot({ path: join(marca, "8-propuesta-pdf.png") });
  }

  // Imagen Open Graph (WhatsApp / Facebook)
  writeFileSync(join(marca, "9-imagen-og-es.png"), await (await p.request.get(`${base}/es/opengraph-image`)).body());
  writeFileSync(join(marca, "9-imagen-og-pt.png"), await (await p.request.get(`${base}/pt/opengraph-image`)).body());
  await nav.close();
  console.log("✓ capturas en revisiones/marca/");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
