// Graba la landing haciendo scroll (escritorio y celular, video .webm) y captura la pantalla
// Configuración → Apariencia con dos presets. Uso (servidor corriendo en E2E_PORT o 3100):
//   npm run capturas:animaciones
// Los presets se eligen en la vista previa SIN guardar: no cambia el tema publicado.
import "dotenv/config";
import { mkdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "@playwright/test";

const base = `http://localhost:${process.env.E2E_PORT ?? 3100}`;
const salida = join("revisiones", "animaciones");
mkdirSync(salida, { recursive: true });

async function recorrer(page: Page) {
  await page.waitForTimeout(1800); // entrada de la portada
  const alto = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  for (let y = 0; y < alto; y += 14) {
    await page.mouse.wheel(0, 14);
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(800);
  // abre una pregunta frecuente y vuelve arriba para mostrar el encabezado
  await page.locator(".faq summary").first().click();
  await page.waitForTimeout(700);
  await page.mouse.wheel(0, -500);
  await page.waitForTimeout(900);
}

async function grabar(nombre: string, opciones: { viewport: { width: number; height: number }; movil?: boolean }) {
  const navegador = await chromium.launch();
  const ctx = await navegador.newContext({ viewport: opciones.viewport, isMobile: opciones.movil, hasTouch: opciones.movil, deviceScaleFactor: 1, recordVideo: { dir: salida, size: opciones.viewport } });
  const page = await ctx.newPage();
  await page.goto(`${base}/es`);
  await recorrer(page);
  const video = page.video();
  await ctx.close();
  const ruta = await video?.path();
  if (ruta) renameSync(ruta, join(salida, `${nombre}.webm`));
  await navegador.close();
  console.log(`✓ ${nombre}.webm`);
}

async function apariencia() {
  const navegador = await chromium.launch();
  const page = await navegador.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`${base}/login`);
  await page.getByLabel("Correo").fill(process.env.DRA_EMAIL!);
  await page.getByLabel("Contraseña").fill(process.env.DRA_PASSWORD!);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL(/\/panel/);
  await page.goto(`${base}/panel/configuracion/apariencia`);
  for (const [i, preset] of [
    [1, "academico"],
    [2, "vino"],
    [3, "bosque"],
  ] as const) {
    await page.getByTestId(`preset-${preset}`).click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(salida, `apariencia-${i}-${preset}.png`), fullPage: true });
    console.log(`✓ apariencia-${i}-${preset}.png`);
  }
  // Ejemplo de combinación ilegible: aviso de contraste y botón Guardar deshabilitado.
  await page.getByLabel("Primario", { exact: true }).fill("#f2e6c9");
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(salida, "apariencia-4-contraste-invalido.png"), fullPage: true });
  console.log("✓ apariencia-4-contraste-invalido.png");
  await navegador.close();
}

async function main() {
  await grabar("landing-escritorio", { viewport: { width: 1440, height: 900 } });
  await grabar("landing-celular", { viewport: { width: 390, height: 844 }, movil: true });
  await apariencia();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
