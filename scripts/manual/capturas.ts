// npm run manual:capturas — regenera TODAS las capturas del manual (docs/manual/img) desde cero:
//   1. Recrea la base de DEMOSTRACIÓN cobra_app_demo (local) con datos ficticios (scripts/manual/sembrar-demo.ts).
//   2. Compila la app (npm run build) y la levanta con `next start` apuntando a esa base (puerto 3200).
//   3. Recorre cada paso del manual con Playwright: panel en 1440 px y portal del estudiante en 390 px (celular),
//      con recuadros numerados y flechas.
// Opciones: --sin-build (usa el build actual) · --sin-base (no recrea la base) · --solo=<texto> (solo esas secciones).
// Nunca usa la base de desarrollo (cobra_app) ni envía correos.
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { chromium, expect, type Browser, type Page } from "@playwright/test";
import { Client } from "pg";
import { captura, capturasHechas } from "./anotar";
import { BASE_DEMO, DRA_DEMO, entornoDemo, URL_DEMO } from "./entorno-demo";
import { CARPETA_RECURSOS } from "./recursos";

const args = process.argv.slice(2);
const solo = args.find((a) => a.startsWith("--solo="))?.slice(7);
const ENV = entornoDemo();
const envHijo = { ...process.env, ...ENV } as NodeJS.ProcessEnv;

function correr(cmd: string) {
  console.log(`$ ${cmd}`);
  const r = spawnSync(cmd, { shell: true, stdio: "inherit", env: envHijo });
  if (r.status !== 0) throw new Error(`Falló: ${cmd}`);
}

async function prepararBase() {
  const su = new Client({ connectionString: ENV.PG_SUPERUSER_URL });
  await su.connect();
  await su.query(`DROP DATABASE IF EXISTS ${BASE_DEMO} WITH (FORCE)`);
  await su.end();
  rmSync(".data/demo-manual", { recursive: true, force: true });
  correr("npx tsx scripts/db-setup.ts");
  correr("npx tsx scripts/migrar.ts");
  correr("npx tsx scripts/seed.ts");
  correr("npx tsx scripts/manual/sembrar-demo.ts");
}

async function levantarServidor(): Promise<ChildProcess> {
  // Si ya hay algo en el puerto (otra corrida, un servidor olvidado), las capturas saldrían de ese servidor: se corta.
  const ocupado = await fetch(`${URL_DEMO}/login`).then(() => true, () => false);
  if (ocupado) throw new Error(`El puerto ${ENV.PORT} ya está en uso. Cierra ese servidor (u otra corrida de manual:capturas) o usa MANUAL_PUERTO=otro.`);
  const hijo = spawn(`npx next start -p ${ENV.PORT}`, { shell: true, env: envHijo, stdio: ["ignore", "pipe", "pipe"] });
  hijo.stderr?.on("data", (d) => process.stderr.write(`[servidor] ${d}`));
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch(`${URL_DEMO}/login`);
      if (r.ok) return hijo;
    } catch {
      /* todavía arrancando */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("El servidor de demostración no arrancó en 2 minutos");
}

function detener(hijo: ChildProcess) {
  if (!hijo.pid) return;
  if (process.platform === "win32") spawnSync(`taskkill /pid ${hijo.pid} /T /F`, { shell: true, stdio: "ignore" });
  else hijo.kill("SIGTERM");
}

// ───────────────────────── utilidades del recorrido ─────────────────────────
let nav: Browser;
const db = new Client({ connectionString: ENV.DATABASE_ADMIN_URL });
const uno = async <T = Record<string, string>>(q: string, p: unknown[] = []) => (await db.query(q, p)).rows[0] as T;

async function escritorio(): Promise<Page> {
  const ctx = await nav.newContext({ viewport: { width: 1440, height: 1000 }, locale: "es-BO", timezoneId: "America/La_Paz", reducedMotion: "reduce", baseURL: URL_DEMO });
  return ctx.newPage();
}
async function celular(): Promise<Page> {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "es-BO", timezoneId: "America/La_Paz", reducedMotion: "reduce", baseURL: URL_DEMO });
  return ctx.newPage();
}
async function entrarPanel(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Correo").fill(DRA_DEMO.correo);
  await page.getByLabel("Contraseña", { exact: true }).fill(DRA_DEMO.clave);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL(/\/panel/);
}
async function entrarPortal(page: Page, ruta: string, credencial: string) {
  await page.goto(ruta);
  await page.getByLabel(/Carnet de identidad|PIN/).fill(credencial);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText(/Hola, /).first()).toBeVisible();
}
const ir = async (page: Page, ruta: string) => {
  await page.goto(ruta, { waitUntil: "load" });
  await page.waitForTimeout(300);
};
const seccion = (nombre: string) => !solo || nombre.includes(solo);
const tarjeta = (page: Page, titulo: string | RegExp) => page.locator("div.rounded-xl, section").filter({ has: page.getByText(titulo, { exact: typeof titulo === "string" }) }).last();

// ───────────────────────── recorrido ─────────────────────────
async function recorrido() {
  await db.connect();
  const proyecto = async (cliente: string) => uno<{ id: string; plan_id: string }>("select p.id, p.plan_id from propuestas p join clientes c on c.id=p.cliente_id where c.nombre=$1", [cliente]);
  const tokenDe = async (planId: string) => (await uno<{ token: string }>("select token from enlaces_portal where plan_id=$1 and token is not null", [planId]))?.token;

  // 1. Primeros pasos ─────────────────────────────────────────────
  const anon = await escritorio();
  if (seccion("acceso")) {
    await ir(anon, "/login");
    await anon.getByLabel("Correo").fill(DRA_DEMO.correo);
    await anon.getByLabel("Contraseña", { exact: true }).fill("••••••••••••");
    await captura(anon, "acceso-login", [
      { loc: anon.getByLabel("Correo"), n: 1 },
      { loc: anon.getByLabel("Contraseña", { exact: true }), n: 2 },
      { loc: anon.getByRole("button", { name: "Ingresar" }), n: 3, flecha: "abajo", texto: "Ingresar" },
    ]);
    await captura(anon, "acceso-olvide", [{ loc: anon.getByRole("link", { name: "¿Olvidaste tu contraseña?" }), n: 1, flecha: "arriba", texto: "Si no la recuerdas" }]);
    await ir(anon, "/recuperar");
    await anon.getByLabel("Correo").fill(DRA_DEMO.correo);
    await captura(anon, "acceso-recuperar", [
      { loc: anon.getByLabel("Correo"), n: 1 },
      { loc: anon.getByRole("button", { name: "Enviar enlace" }), n: 2 },
    ]);
  }

  const dra = await escritorio();
  await entrarPanel(dra);

  if (seccion("inicio")) {
    await ir(dra, "/panel");
    await captura(dra, "inicio-panel", [
      { loc: dra.locator("aside").first(), n: 1, margen: -2 },
      { loc: dra.getByRole("search"), n: 2 },
      { loc: dra.getByRole("region", { name: "Indicadores" }).or(dra.locator("section[aria-label='Indicadores']")), n: 3 },
      { loc: tarjeta(dra, "Para recordar hoy"), n: 4, margen: 2 },
      { loc: tarjeta(dra, "Comprobantes por aprobar"), n: 5, margen: 2 },
    ], { sinScroll: true });
    await captura(dra, "inicio-indicadores", [], { recorte: dra.locator("section[aria-label='Indicadores']") });
    await dra.getByTestId("usuario-actual").click();
    await dra.waitForTimeout(300);
    await captura(dra, "inicio-menu-usuario", [
      { loc: dra.getByRole("menuitem", { name: /Modo oscuro/ }), n: 1 },
      { loc: dra.getByRole("menuitem", { name: "Mi cuenta y contraseña" }), n: 2 },
      { loc: dra.getByRole("menuitem", { name: "Ayuda" }), n: 3 },
      { loc: dra.getByRole("menuitem", { name: "Cerrar sesión" }), n: 4 },
    ], { sinScroll: true });
    await dra.keyboard.press("Escape");
    await ir(dra, "/panel/cuenta");
    await dra.getByLabel("Contraseña actual").fill("contraseña-actual");
    await dra.getByLabel("Nueva contraseña", { exact: true }).fill("una-contraseña-nueva-larga");
    await dra.getByLabel("Repite la nueva contraseña").fill("una-contraseña-nueva-larga");
    await captura(dra, "cuenta-cambiar-clave", [
      { loc: dra.getByLabel("Contraseña actual"), n: 1 },
      { loc: dra.getByLabel("Nueva contraseña", { exact: true }), n: 2 },
      { loc: dra.getByLabel("Repite la nueva contraseña"), n: 3 },
      { loc: dra.getByRole("button", { name: "Cambiar contraseña" }), n: 4 },
    ], { sinScroll: true });
    await ir(dra, "/panel");
    await captura(dra, "inicio-tipo-cambio", [], { recorte: tarjeta(dra, "Tipo de cambio oficial") });
    // Ayuda
    await ir(dra, "/panel/cobros/clientes");
    await captura(dra, "ayuda-boton", [{ loc: dra.getByTestId("boton-ayuda"), flecha: "der", texto: "Ayuda de esta pantalla" }], { sinScroll: true });
    await ir(dra, "/panel/ayuda");
    await dra.getByLabel("Buscar en el manual").fill("comprobante");
    await dra.waitForTimeout(400);
    await captura(dra, "ayuda-manual", [
      { loc: dra.getByRole("link", { name: "Ayuda" }).first(), n: 1 },
      { loc: dra.getByLabel("Buscar en el manual"), n: 2 },
    ], { sinScroll: true });
    // Búsqueda global
    await dra.getByLabel("Buscar en el panel").fill("Mamani");
    await dra.getByLabel("Buscar en el panel").press("Enter");
    await dra.waitForURL(/buscar/);
    await captura(dra, "inicio-buscar", [{ loc: dra.getByLabel("Buscar en el panel"), n: 1 }], { sinScroll: true });
  }

  // 8. Recordatorios y plantillas (antes de cambiar estados) ───────
  if (seccion("recordatorios")) {
    await ir(dra, "/panel/cobros/recordatorios");
    await captura(dra, "recordatorios-lista", [
      { loc: dra.getByTestId("grupo-vence_en_3_dias"), n: 1, margen: 2 },
      { loc: dra.getByTestId("grupo-vence_hoy"), n: 2, margen: 2 },
    ], { sinScroll: true });
    const wa = dra.getByTestId("grupo-en_cola").getByRole("link", { name: /WhatsApp/ }).first();
    await captura(dra, "recordatorios-whatsapp", [
      { loc: dra.getByTestId("grupo-vencida"), n: 1, margen: 2 },
      { loc: dra.getByTestId("grupo-en_cola"), n: 2, margen: 2 },
      { loc: wa, n: 3 },
    ]);
    await ir(dra, "/panel/cobros/plantillas");
    const primera = dra.locator("div.rounded-xl").filter({ hasText: "Recordatorio de cuota" }).last();
    await primera.getByRole("textbox").fill("Hola {nombre} 😊, te recuerdo que tu cuota de {monto} {moneda} vence el {fecha}. Puedes pagar con QR en: {enlace}");
    await captura(dra, "plantillas", [
      { loc: dra.locator("code").first().locator(".."), n: 1 },
      { loc: primera.getByRole("textbox"), n: 2 },
      { loc: primera.getByText("Vista previa").locator(".."), n: 3 },
      { loc: primera.getByRole("button", { name: "Guardar" }), n: 4, flecha: "der", texto: "Guardar" },
    ], { recorte: dra.locator("main") });
  }

  // 3. Clientes ───────────────────────────────────────────────────
  if (seccion("clientes")) {
    await ir(dra, "/panel/cobros/clientes");
    await captura(dra, "clientes-lista", [
      { loc: dra.getByRole("button", { name: "Nuevo cliente" }), n: 1 },
      { loc: dra.getByLabel("Buscar por nombre, CI, celular o correo"), n: 2 },
    ], { sinScroll: true });
    await dra.getByRole("button", { name: "Nuevo cliente" }).click();
    const dlg = dra.getByRole("dialog");
    await dlg.getByLabel("Nombre completo").fill("Paola Vargas Justiniano");
    await dlg.getByLabel("CI", { exact: true }).fill("8899001");
    await dlg.getByLabel("Celular WhatsApp (con código de país)").fill("59171000999");
    await dlg.getByLabel("Correo", { exact: true }).fill("paola.vargas@ejemplo.com");
    await captura(dra, "clientes-nuevo", [
      { loc: dlg.getByLabel("Nombre completo"), n: 1 },
      { loc: dlg.getByLabel("CI", { exact: true }), n: 2 },
      { loc: dlg.getByLabel("Celular WhatsApp (con código de país)"), n: 3 },
      { loc: dlg.getByLabel("Correo", { exact: true }), n: 4 },
      { loc: dlg.getByRole("button", { name: "Agregar cliente" }), n: 5 },
    ], { sinScroll: true });
    await dlg.getByRole("button", { name: "Agregar cliente" }).click();
    await dra.waitForTimeout(800);
    await dra.keyboard.press("Escape");
    await dra.getByLabel("Buscar por nombre, CI, celular o correo").fill("rojas");
    await dra.waitForTimeout(300);
    await captura(dra, "clientes-buscar", [{ loc: dra.getByLabel("Buscar por nombre, CI, celular o correo"), n: 1, flecha: "abajo", texto: "Escribe parte del nombre o el CI" }], { sinScroll: true });
    const m = await proyecto("Mariana Rojas Vaca");
    const cl = await uno<{ id: string }>("select id from clientes where nombre='Mariana Rojas Vaca'");
    void m;
    const paola = await uno<{ id: string }>("select id from clientes where nombre='Paola Vargas Justiniano'");
    await ir(dra, `/panel/cobros/clientes/${paola.id}`);
    await captura(dra, "eliminar-boton", [{ loc: dra.getByTestId("boton-eliminar"), n: 1, flecha: "abajo", texto: "Eliminar" }], { sinScroll: true });
    await dra.getByTestId("boton-eliminar").click();
    await captura(dra, "eliminar-confirmar", [{ loc: dra.getByRole("alertdialog"), n: 1, margen: 2 }, { loc: dra.getByRole("button", { name: "Sí, eliminar" }), n: 2 }], { sinScroll: true });
    await dra.getByRole("button", { name: "Sí, eliminar" }).click();
    await dra.waitForURL(/eliminado=1/);
    await captura(dra, "eliminar-listo", [{ loc: dra.getByText(/Cliente eliminado/), n: 1 }], { sinScroll: true });
    await ir(dra, `/panel/cobros/clientes/${cl.id}`);
    await captura(dra, "clientes-ficha", [
      { loc: tarjeta(dra, "Planes de pago"), n: 1, margen: 2 },
      { loc: tarjeta(dra, "Datos del cliente"), n: 2, margen: 2 },
      { loc: dra.getByRole("button", { name: "Guardar cambios" }), n: 3 },
    ], { sinScroll: true });
  }

  // 2. Configurar la cuenta ───────────────────────────────────────
  if (seccion("configuracion")) {
    await ir(dra, "/panel/configuracion");
    await captura(dra, "config-organizacion", [
      { loc: dra.getByLabel("Nombre", { exact: true }), n: 1 },
      { loc: dra.getByLabel("WhatsApp del negocio"), n: 2 },
      { loc: dra.getByLabel("Datos bancarios (se muestran en el portal junto al QR)"), n: 3 },
      { loc: dra.getByLabel("Imagen del QR estático de cobro"), n: 4 },
      { loc: dra.getByRole("button", { name: "Guardar" }), n: 5, flecha: "der", texto: "Guardar" },
    ], { completa: false, recorte: dra.locator("main") });
    await ir(dra, "/panel/configuracion/apariencia");
    await captura(dra, "config-apariencia", [
      { loc: tarjeta(dra, "Combinaciones listas"), n: 1, margen: 2 },
      { loc: dra.getByText("Vista previa en vivo").locator(".."), n: 2, margen: 2 },
    ], { sinScroll: true });
    await captura(dra, "config-apariencia-colores", [{ loc: tarjeta(dra, "Colores"), n: 1, margen: 2 }], { recorte: tarjeta(dra, "Colores") });
    await captura(dra, "config-apariencia-fuentes", [], { recorte: tarjeta(dra, "Tipografía y bordes") });
    await captura(dra, "config-apariencia-intro", [
      { loc: dra.getByText("Mostrar la intro animada"), n: 1 },
      { loc: dra.getByTestId("guardar-apariencia"), n: 2 },
    ]);
    await captura(dra, "config-logo", [{ loc: dra.getByTestId("marca-logo").getByRole("button", { name: "Subir" }), n: 1 }, { loc: dra.getByTestId("marca-isotipo").getByRole("button", { name: "Subir" }), n: 2 }], { recorte: tarjeta(dra, "Logo e isotipo") });
    await ir(dra, "/panel/tesis/landing");
    await dra.getByLabel("Elegir la foto").setInputFiles(`${CARPETA_RECURSOS}/foto-demo.png`);
    await captura(dra, "config-foto", [
      { loc: dra.getByLabel("Elegir la foto"), n: 1 },
      { loc: dra.getByRole("button", { name: "Subir foto" }), n: 2, flecha: "der", texto: "Subir" },
    ], { recorte: dra.getByTestId("foto-landing") });
    await dra.getByRole("button", { name: "Subir foto" }).click();
    await expect(dra.getByAltText("Foto actual de la portada")).toBeVisible();
    await captura(dra, "config-foto-lista", [{ loc: dra.getByAltText("Foto actual de la portada"), n: 1 }, { loc: dra.getByRole("button", { name: "Quitar foto" }), n: 2 }], { recorte: dra.getByTestId("foto-landing") });
    const landing = await escritorio();
    await landing.goto("/es");
    await landing.waitForTimeout(2500);
    await landing.keyboard.press("Escape");
    await landing.waitForTimeout(800);
    await captura(landing, "config-foto-pagina", [{ loc: landing.locator('img[src*="/foto"]').first(), n: 1 }], { sinScroll: true });
    await landing.context().close();
    await ir(dra, "/panel/tesis/landing");
    await captura(dra, "config-landing", [
      { loc: dra.getByRole("navigation", { name: "Idioma" }), n: 1 },
      { loc: dra.getByRole("link", { name: /Ver la página/ }), n: 2 },
      { loc: dra.getByRole("button", { name: /Guardar textos/ }), n: 3 },
    ], { sinScroll: true });
    const testimonios = dra.getByLabel("Testimonios", { exact: true });
    await testimonios.fill("La Dra. me ayudó a ordenar mi tesis mes a mes. | Ejemplo de testimonio — Enfermería");
    await captura(dra, "config-testimonios", [{ loc: testimonios, n: 1 }], { recorte: tarjeta(dra, "9. Testimonios") });
    await testimonios.fill("");
  }

  // 4. Propuesta en 10 pasos (ejemplo completo) ───────────────────
  let urlSofia = "";
  if (seccion("propuesta")) {
    await ir(dra, "/panel/tesis/propuestas");
    await captura(dra, "propuesta-lista", [
      { loc: dra.getByRole("link", { name: "Nueva propuesta" }), n: 1, flecha: "abajo", texto: "Empieza aquí" },
      { loc: dra.getByLabel("Estado"), n: 2 },
    ], { sinScroll: true });
    await dra.getByRole("link", { name: "Nueva propuesta" }).click();
    await dra.waitForURL(/nueva/);
    await dra.getByLabel("Nombre del proyecto o tema").fill("Estrategias de aprendizaje y rendimiento académico en estudiantes de Enfermería");
    await dra.getByLabel("Nombre del estudiante").fill("Sofía Méndez Arteaga");
    await dra.getByLabel("CI del estudiante").fill("8123456");
    await dra.getByLabel("WhatsApp del estudiante").fill("59171000111");
    await dra.getByLabel("Correo del estudiante").fill("sofia.mendez@ejemplo.com");
    await dra.getByLabel("Universidad").fill("Universidad Amazónica de Pando");
    await captura(dra, "propuesta-paso01", [
      { loc: dra.getByRole("navigation", { name: "Pasos" }), n: 1 },
      { loc: dra.getByLabel("Nombre del proyecto o tema"), n: 2 },
      { loc: dra.getByText("Nuevo", { exact: true }).locator(".."), n: 3 },
      { loc: dra.getByLabel("CI del estudiante"), n: 4 },
      { loc: dra.getByLabel("Nivel"), n: 5 },
      { loc: dra.getByRole("button", { name: "Siguiente" }), n: 6, flecha: "izq", texto: "Siguiente" },
    ], { sinScroll: true });
    const sig = () => dra.getByRole("button", { name: "Siguiente" }).click();
    await sig();
    await captura(dra, "propuesta-paso02", [{ loc: dra.getByRole("radiogroup", { name: "Moneda de la propuesta" }), n: 1 }], { sinScroll: true });
    await sig();
    await dra.getByLabel("N.º de cuotas").fill("5");
    await dra.getByLabel("Total (BOB)").fill("9000");
    await captura(dra, "propuesta-paso03-generar", [
      { loc: dra.getByLabel("N.º de cuotas"), n: 1 },
      { loc: dra.getByLabel("Total (BOB)"), n: 2 },
      { loc: dra.getByLabel("1.ª fecha"), n: 3 },
      { loc: dra.getByRole("button", { name: "Generar" }), n: 4, flecha: "abajo", texto: "Generar" },
    ], { sinScroll: true });
    await dra.getByRole("button", { name: "Generar" }).click();
    for (const [i, v] of ["2000", "2000", "2000", "2000", "1000"].entries()) {
      const campo = dra.getByLabel(`Monto cuota ${i + 1}`);
      await campo.fill(v);
      await campo.blur();
    }
    await expect(dra.getByTestId("total-plan")).toHaveText("Bs 9.000,00");
    await captura(dra, "propuesta-paso03-cuotas", [
      { loc: dra.getByLabel("Monto cuota 5"), n: 1 },
      { loc: dra.getByLabel("Fecha cuota 5"), n: 2 },
      { loc: dra.getByRole("button", { name: "Agregar cuota" }), n: 3 },
      { loc: dra.getByTestId("total-plan"), n: 4 },
    ]);
    await sig();
    await dra.getByRole("button", { name: "Cargar plantilla" }).click();
    await captura(dra, "propuesta-paso04", [
      { loc: dra.getByRole("button", { name: "Cargar plantilla" }), n: 1, flecha: "der", texto: "Plantilla de 9 actividades" },
      { loc: dra.getByLabel("Revisión bibliográfica en mes 3"), n: 2 },
      { loc: dra.getByRole("button", { name: "Agregar actividad" }), n: 3 },
    ], { sinScroll: true });
    await sig();
    await dra.getByLabel("Aplicar recargo por mora").check();
    await dra.getByLabel("Recargo (%)").fill("5");
    await captura(dra, "propuesta-paso05", [
      { loc: dra.getByLabel("Plazo para pagar la 1.ª cuota tras aceptar (días)"), n: 1 },
      { loc: dra.getByLabel("Días de gracia (0–30)"), n: 2 },
      { loc: dra.getByLabel("Gracia en una nueva mora (días)"), n: 3 },
      { loc: dra.getByLabel("Aplicar recargo por mora"), n: 4, margen: 8 },
      { loc: dra.getByLabel("Recargo (%)"), n: 5 },
      { loc: dra.getByLabel("Aplicación"), n: 6 },
    ], { sinScroll: true });
    await sig();
    await dra.getByLabel("Precio de la 3.ª revisión (BOB)").fill("500");
    await captura(dra, "propuesta-paso06", [{ loc: dra.getByLabel("Precio de la 3.ª revisión (BOB)"), n: 1, flecha: "der", texto: "Precio de la 3.ª revisión" }], { sinScroll: true });
    await sig();
    await captura(dra, "propuesta-paso07", [
      { loc: dra.getByLabel("Extra", { exact: true }).first(), n: 1 },
      { loc: dra.getByLabel("Precio", { exact: true }).first(), n: 2 },
      { loc: dra.getByRole("button", { name: "Agregar extra" }), n: 3 },
    ], { sinScroll: true });
    await sig();
    await dra.getByLabel("Formulario de recolección de datos").selectOption({ label: "Datos para iniciar tu tesis" });
    await captura(dra, "propuesta-paso08", [{ loc: dra.getByLabel("Formulario de recolección de datos"), n: 1 }], { sinScroll: true });
    await sig();
    await dra.getByLabel("Vigencia del enlace (días)").fill("7");
    await captura(dra, "propuesta-paso09", [{ loc: dra.getByLabel("Vigencia del enlace (días)"), n: 1, flecha: "der", texto: "Días para aceptar" }], { sinScroll: true });
    await sig();
    await captura(dra, "propuesta-paso10", [
      { loc: dra.getByTestId("total-propuesta").locator("xpath=ancestor::dl"), n: 1, margen: 2 },
      { loc: dra.getByRole("button", { name: "Guardar propuesta" }), n: 2 },
    ], { sinScroll: true });
    await dra.getByRole("button", { name: "Guardar propuesta" }).click();
    await dra.waitForURL(/\/panel\/tesis\/propuestas\/[0-9a-f-]{36}$/);
    await dra.waitForTimeout(500);
    await captura(dra, "propuesta-ficha-borrador", [
      { loc: dra.getByRole("link", { name: "Ver PDF" }), n: 1 },
      { loc: dra.getByRole("link", { name: "Editar" }), n: 2 },
      { loc: dra.getByRole("radiogroup", { name: "Forma de acceso" }), n: 3 },
      { loc: dra.getByRole("button", { name: "Generar enlace y enviar" }), n: 4, flecha: "der", texto: "Enviar" },
    ], { sinScroll: true });
    // 5. Enviar por WhatsApp
    await dra.getByRole("button", { name: "Generar enlace y enviar" }).click();
    await expect(dra.getByTestId("url-propuesta")).toBeVisible();
    urlSofia = new URL((await dra.getByTestId("url-propuesta").textContent())!.trim()).pathname;
    await captura(dra, "enviar-enlace-generado", [
      { loc: dra.getByTestId("url-propuesta"), n: 1 },
      { loc: dra.getByRole("link", { name: "Enviar por WhatsApp" }), n: 2, flecha: "abajo", texto: "Abre WhatsApp con el mensaje" },
      { loc: dra.getByRole("button", { name: "Copiar enlace" }), n: 3 },
    ]);
    await dra.reload();
    await captura(dra, "enviar-vigencia", [{ loc: dra.getByText(/El enlace vence el/).locator("xpath=ancestor::div[contains(@class,'rounded-lg')][1]"), n: 1 }]);
    const diego = await proyecto("Diego Fernández Paz");
    await ir(dra, `/panel/tesis/propuestas/${diego.id}`);
    await captura(dra, "enviar-vencida", [
      { loc: dra.getByText("La propuesta venció sin ser aceptada").locator("xpath=ancestor::div[contains(@class,'rounded-lg')][1]"), n: 1 },
      { loc: dra.getByRole("link", { name: "Editar" }), n: 2 },
      { loc: dra.getByRole("button", { name: "Reenviar con enlace nuevo" }), n: 3, flecha: "der", texto: "Enlace nuevo" },
    ], { sinScroll: true });
    await captura(dra, "eliminar-propuesta", [{ loc: dra.getByTestId("boton-eliminar"), n: 1 }], { recorte: tarjeta(dra, "Propuesta y enlace") });
    await ir(dra, `/panel/tesis/propuestas/${diego.id}/editar`);
    await dra.getByRole("button", { name: /3\. Plan de pagos/ }).click();
    await captura(dra, "enviar-editar", [
      { loc: dra.getByRole("navigation", { name: "Pasos" }), n: 1 },
      { loc: dra.getByRole("button", { name: "Guardar cambios" }), n: 2, flecha: "izq", texto: "Guardar cambios" },
    ], { sinScroll: true });
  }

  // Portal del estudiante (celular) ───────────────────────────────
  const sofia = await celular();
  if (seccion("estudiante")) {
    urlSofia ||= `/p/${await tokenDe((await proyecto("Sofía Méndez Arteaga")).plan_id)}`;
    await sofia.goto(urlSofia);
    await captura(sofia, "est-acceso", [
      { loc: sofia.getByLabel("Carnet de identidad (CI)"), n: 1 },
      { loc: sofia.getByRole("button", { name: "Entrar" }), n: 2 },
      { loc: sofia.getByTestId("boton-guia"), n: 3 },
    ], { sinScroll: true });
    await sofia.getByLabel("Carnet de identidad (CI)").fill("8123465");
    await sofia.getByRole("button", { name: "Entrar" }).click();
    await expect(sofia.getByText(/Dato incorrecto/)).toBeVisible();
    await captura(sofia, "est-acceso-error", [{ loc: sofia.getByText(/Dato incorrecto/), n: 1 }], { sinScroll: true });
    await sofia.getByLabel("Carnet de identidad (CI)").fill("8123456");
    await sofia.getByRole("button", { name: "Entrar" }).click();
    await expect(sofia.getByText("1. Revisa tu propuesta")).toBeVisible();
    await captura(sofia, "est-propuesta", [{ loc: sofia.getByRole("navigation", { name: "Tus pasos" }), n: 1 }, { loc: sofia.getByText("Inversión total").locator(".."), n: 2 }], { sinScroll: true });
    await captura(sofia, "est-propuesta-cuotas", [{ loc: sofia.getByRole("heading", { name: "Tus cuotas" }), n: 1 }, { loc: sofia.getByRole("region", { name: "Cronograma de actividades por mes" }), n: 2 }]);
    await captura(sofia, "est-aceptar", [
      { loc: sofia.getByRole("link", { name: "Descargar PDF" }), n: 1 },
      { loc: sofia.getByRole("button", { name: "Acepto la propuesta" }), n: 2, flecha: "arriba", texto: "Aceptar" },
    ]);
    await sofia.getByRole("button", { name: "Acepto la propuesta" }).click();
    await captura(sofia, "est-aceptar-confirmar", [{ loc: sofia.getByRole("button", { name: "Sí, acepto" }), n: 1 }], { sinScroll: true });
    await sofia.getByRole("button", { name: "Sí, acepto" }).click();
    await expect(sofia.getByTestId("aceptada-portal")).toBeVisible();
    await sofia.waitForTimeout(500);
    await captura(sofia, "est-pagar-qr", [
      { loc: sofia.getByTestId("monto-bs"), n: 1 },
      { loc: sofia.getByAltText("Código QR para pagar"), n: 2 },
    ]);
    await captura(sofia, "est-ya-pague", [{ loc: sofia.getByRole("button", { name: "Ya pagué, subir comprobante" }), n: 1, flecha: "arriba", texto: "Después de pagar" }]);
    await sofia.getByRole("button", { name: "Ya pagué, subir comprobante" }).click();
    await sofia.locator("input[type=file]").first().setInputFiles(`${CARPETA_RECURSOS}/comprobante-demo.png`);
    await captura(sofia, "est-comprobante-elegido", [
      { loc: sofia.getByText("comprobante-demo.png"), n: 1 },
      { loc: sofia.getByRole("button", { name: "Enviar comprobante" }), n: 2, flecha: "arriba", texto: "Enviar" },
    ]);
    await sofia.getByRole("button", { name: "Enviar comprobante" }).click();
    const okComprobante = sofia.getByRole("status").filter({ hasText: /omprobante/ }).first();
    await expect(okComprobante).toBeVisible({ timeout: 20_000 });
    await captura(sofia, "est-comprobante-enviado", [{ loc: okComprobante, n: 1 }]);
    await sofia.reload();
    await captura(sofia, "est-cuota-en-revision", [{ loc: sofia.getByTestId("portal-cuota-1").last(), n: 1, texto: "En revisión" }]);
    // Formulario
    const form = sofia.locator("section").filter({ has: sofia.getByRole("heading", { name: "Datos para iniciar tu tesis" }) });
    await form.getByLabel("Carrera *").fill("Enfermería");
    await form.getByLabel("¿Qué problema te interesa investigar? *").fill("Quiero saber qué estrategias de estudio usan mis compañeros y si se relacionan con sus notas.");
    await form.getByLabel("Modalidad de las reuniones *").selectOption("Virtual (Zoom o Meet)");
    await captura(sofia, "est-formulario", [
      { loc: form.getByLabel("Carrera *"), n: 1 },
      { loc: form.getByLabel("Modalidad de las reuniones *"), n: 2 },
    ]);
    await form.getByLabel("Datos recolectados").setInputFiles({ name: "Datos_encuesta.zip", mimeType: "application/zip", buffer: Buffer.from("UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==", "base64") });
    await captura(sofia, "est-formulario-enviar", [
      { loc: form.getByLabel("Datos recolectados"), n: 3 },
      { loc: form.getByRole("button", { name: "Enviar formulario" }), n: 4, flecha: "arriba", texto: "Enviar" },
    ]);
    await form.getByRole("button", { name: "Enviar formulario" }).click();
    await expect(form.getByRole("status").or(form.getByText(/enviad|Gracias/i)).first()).toBeVisible({ timeout: 20_000 });
    await captura(sofia, "est-formulario-ok", [{ loc: form.getByRole("status").first(), n: 1 }]);
    // Archivos
    const arch = sofia.locator("section").filter({ has: sofia.getByRole("heading", { name: "Tus archivos" }) });
    await arch.locator("input[type=file]").setInputFiles([
      { name: "Avance_capitulo_1.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%demo\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF") },
      { name: "Fotos_y_audios.zip", mimeType: "application/zip", buffer: Buffer.from("UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==", "base64") },
    ]);
    await arch.getByLabel("Descripción (opcional)").fill("Avance del capítulo 1");
    await captura(sofia, "est-archivos", [
      { loc: arch.locator("label").first(), n: 1 },
      { loc: arch.getByLabel("Descripción (opcional)"), n: 2 },
      { loc: arch.getByRole("button", { name: "Subir archivos" }), n: 3, flecha: "arriba", texto: "Subir" },
    ]);
    await arch.getByRole("button", { name: "Subir archivos" }).click();
    await expect(arch.getByText("Archivos subidos.")).toBeVisible({ timeout: 20_000 });
    await captura(sofia, "est-archivos-ok", [{ loc: arch.getByText("Archivos subidos."), n: 1 }]);
    const extras = sofia.locator("section").filter({ has: sofia.getByRole("heading", { name: "¿Necesitas algo más?" }) });
    await captura(sofia, "est-extras", [
      { loc: extras.getByRole("button", { name: "Pedir 3.ª revisión" }), n: 1 },
      { loc: extras.getByRole("button", { name: /Pedir diapositivas/ }), n: 2 },
    ]);
  }

  // 6. Cobros: comprobantes ───────────────────────────────────────
  if (seccion("comprobantes")) {
    await ir(dra, "/panel/cobros/pagos");
    const sofiaCard = dra.getByTestId("comprobante-pendiente").filter({ hasText: "Sofía Méndez Arteaga" });
    await captura(dra, "cobros-comprobantes", [
      { loc: sofiaCard.locator("a").first(), n: 1 },
      { loc: sofiaCard.getByRole("button", { name: "Aprobar" }), n: 2 },
      { loc: sofiaCard.getByRole("button", { name: "Rechazar" }), n: 3 },
    ], { sinScroll: true });
    const gab = dra.getByTestId("comprobante-pendiente").filter({ hasText: "Gabriela Ortiz Saucedo" });
    await gab.getByRole("button", { name: "Rechazar" }).click();
    await dra.getByLabel("Motivo del rechazo").fill("El monto del comprobante (Bs 500) no coincide con la cuota (Bs 600). Por favor, completa la diferencia y sube el nuevo comprobante.");
    await captura(dra, "cobros-rechazar", [
      { loc: dra.getByLabel("Motivo del rechazo"), n: 1 },
      { loc: dra.getByRole("button", { name: "Confirmar rechazo" }), n: 2 },
    ], { sinScroll: true });
    await dra.getByRole("button", { name: "Confirmar rechazo" }).click();
    await dra.waitForURL(/hecho=rechazado/);
    await sofiaCard.getByRole("button", { name: "Aprobar" }).click();
    await dra.waitForURL(/hecho=aprobado/);
    await dra.waitForTimeout(500);
    await captura(dra, "cobros-aprobado", [
      { loc: dra.getByText("Pago aprobado.", { exact: true }), n: 1 },
      { loc: tarjeta(dra, "Revisados recientemente"), n: 2, margen: 2 },
    ], { sinScroll: true });
    // El estudiante ve el pago aprobado y su próxima cuota
    await sofia.reload();
    await captura(sofia, "est-proxima-cuota", [{ loc: sofia.getByText("Tu próxima cuota", { exact: true }), n: 1 }, { loc: sofia.getByTestId("monto-bs"), n: 2 }], { sinScroll: false });
    await captura(sofia, "est-historial-pagos", [{ loc: sofia.getByRole("heading", { name: "Historial de pagos" }), n: 1 }]);
    await sofia.getByRole("button", { name: "Pedir 3.ª revisión" }).click();
    await captura(sofia, "est-pedir-revision", [{ loc: sofia.getByRole("button", { name: "Sí, pedirla" }), n: 1 }], { sinScroll: true });
    await sofia.getByRole("button", { name: "Cancelar" }).click();
  }

  // 6. Cobros: plan, cuotas, historial ────────────────────────────
  const mariana = await proyecto("Mariana Rojas Vaca");
  if (seccion("plan")) {
    await ir(dra, "/panel/cobros/planes");
    await captura(dra, "cobros-planes", [
      { loc: dra.getByLabel("Buscar por concepto o cliente"), n: 1 },
      { loc: dra.getByLabel("Estado"), n: 2 },
      { loc: dra.getByRole("link", { name: "Nuevo plan" }), n: 3 },
    ], { sinScroll: true });
    await ir(dra, `/panel/cobros/planes/${mariana.plan_id}`);
    await captura(dra, "cobros-plan", [
      { loc: tarjeta(dra, "Cuotas").first(), n: 1, margen: 2 },
      { loc: tarjeta(dra, "Resumen"), n: 2, margen: 2 },
      { loc: tarjeta(dra, "Portal del cliente"), n: 3, margen: 2 },
      { loc: dra.getByRole("link", { name: /WhatsApp/ }).first(), n: 4 },
    ], { sinScroll: true });
    const editar = tarjeta(dra, "Editar plan");
    await editar.scrollIntoViewIfNeeded();
    await dra.getByLabel("Fecha cuota 3").fill(await (async () => (await uno<{ f: string }>("select to_char(fecha_vencimiento + 5, 'YYYY-MM-DD') as f from cuotas where plan_id=$1 and numero=3", [mariana.plan_id])).f)());
    await captura(dra, "cobros-editar-cuotas", [
      { loc: dra.getByRole("tab", { name: "Cuotas" }), n: 1 },
      { loc: dra.getByLabel("Fecha cuota 3"), n: 2 },
      { loc: dra.getByRole("button", { name: "Agregar cuota" }), n: 3 },
      { loc: dra.getByRole("button", { name: "Guardar cuotas" }), n: 4, flecha: "der", texto: "Guardar" },
    ]);
    await dra.getByRole("button", { name: "Guardar cuotas" }).click();
    await dra.waitForTimeout(1200);
    await captura(dra, "cobros-historial", [{ loc: dra.getByTestId("historial").locator("li").first(), n: 1 }], { recorte: tarjeta(dra, "Historial de cambios") });
    await dra.getByRole("tab", { name: "Reglas de mora" }).click();
    await captura(dra, "cobros-reglas-mora", [
      { loc: dra.getByRole("tab", { name: "Reglas de mora" }), n: 1 },
      { loc: dra.getByRole("button", { name: "Guardar reglas" }), n: 2 },
    ], { recorte: tarjeta(dra, "Editar plan") });
    const rodrigo = await uno<{ id: string }>("select p.id from planes_pago p join clientes c on c.id=p.cliente_id where c.nombre='Rodrigo Céspedes Áñez'");
    await ir(dra, `/panel/cobros/planes/${rodrigo.id}`);
    await captura(dra, "eliminar-plan", [{ loc: dra.getByTestId("boton-eliminar"), n: 1, flecha: "abajo", texto: "Eliminar plan" }], { sinScroll: true });
    await ir(dra, "/panel/cobros/planes/nuevo");
    await captura(dra, "cobros-plan-nuevo", [
      { loc: dra.getByLabel("Cliente"), n: 1 },
      { loc: dra.getByLabel("Concepto"), n: 2 },
      { loc: dra.getByLabel("Moneda"), n: 3 },
      { loc: dra.getByRole("button", { name: "Crear plan" }), n: 4 },
    ], { sinScroll: true });
  }

  // 7. Mora: en cola → paga → cronograma nuevo → en curso ─────────
  if (seccion("mora")) {
    const jose = await proyecto("José Luis Mamani Quispe");
    await ir(dra, `/panel/cobros/planes/${jose.plan_id}`);
    await captura(dra, "mora-plan-en-cola", [
      { loc: dra.getByTestId("cuota-2"), n: 1 },
      { loc: dra.locator("main h1").locator("xpath=following::span[contains(.,'En cola')][1]").first(), n: 2 },
    ], { sinScroll: true });
    await ir(dra, `/panel/tesis/propuestas/${jose.id}`);
    await captura(dra, "mora-proyecto-en-cola", [{ loc: tarjeta(dra, "Nuevo cronograma"), n: 1, margen: 2 }]);
    // El estudiante paga la cuota atrasada (con recargo)
    const josePortal = await celular();
    await entrarPortal(josePortal, `/p/${await tokenDe(jose.plan_id)}`, "6123456");
    await captura(josePortal, "est-en-pausa", [{ loc: josePortal.getByText("Tu proyecto está en pausa"), n: 1 }, { loc: josePortal.getByTestId("monto-bs"), n: 2 }], { sinScroll: true });
    await josePortal.getByRole("button", { name: "Ya pagué, subir comprobante" }).click();
    await josePortal.locator("input[type=file]").first().setInputFiles(`${CARPETA_RECURSOS}/comprobante-demo.png`);
    await josePortal.getByRole("button", { name: "Enviar comprobante" }).click();
    await expect(josePortal.getByText(/Comprobante enviado/).first()).toBeVisible({ timeout: 20_000 });
    await ir(dra, "/panel/cobros/pagos");
    await dra.getByTestId("comprobante-pendiente").filter({ hasText: "José Luis Mamani Quispe" }).getByRole("button", { name: "Aprobar" }).click();
    await dra.waitForURL(/hecho=aprobado/);
    await ir(dra, `/panel/tesis/propuestas/${jose.id}`);
    const nuevo = tarjeta(dra, "Nuevo cronograma");
    await captura(dra, "mora-nuevo-cronograma", [
      { loc: nuevo.getByLabel("Inicio"), n: 1 },
      { loc: nuevo.getByRole("button", { name: "Cargar plantilla" }), n: 2 },
      { loc: nuevo.getByRole("button", { name: "Enviar nuevo cronograma al estudiante" }), n: 3, flecha: "der", texto: "Enviar" },
    ]);
    await nuevo.getByRole("button", { name: "Enviar nuevo cronograma al estudiante" }).click();
    await expect(dra.getByText(/falta que el estudiante la acepte/)).toBeVisible();
    await captura(dra, "mora-cronograma-enviado", [{ loc: dra.getByText(/falta que el estudiante la acepte/), n: 1 }]);
    await josePortal.reload();
    await captura(josePortal, "est-nuevo-cronograma", [{ loc: josePortal.getByRole("button", { name: "Acepto el nuevo cronograma" }), n: 1, flecha: "arriba", texto: "Aceptar" }]);
    await josePortal.getByRole("button", { name: "Acepto el nuevo cronograma" }).click();
    await josePortal.waitForTimeout(1200);
    await ir(dra, `/panel/tesis/propuestas/${jose.id}`);
    await captura(dra, "mora-en-curso", [{ loc: dra.getByTestId("estado-proyecto"), n: 1 }], { sinScroll: true });
    await josePortal.context().close();
  }

  // 9. Cronograma, calendario y ficha del proyecto ────────────────
  if (seccion("ficha")) {
    await ir(dra, `/panel/tesis/propuestas/${mariana.id}`);
    await captura(dra, "ficha-resumen", [
      { loc: dra.getByTestId("estado-proyecto"), n: 1 },
      { loc: dra.getByTestId("avance"), n: 2 },
      { loc: dra.getByRole("tablist", { name: "Secciones del proyecto" }), n: 3 },
      { loc: dra.getByRole("link", { name: /WhatsApp/ }).first(), n: 4 },
    ], { sinScroll: true });
    await dra.getByRole("tab", { name: /Cronograma/ }).click();
    const casilla = dra.getByLabel('Marcar "Sistematización de información" como hecha');
    await casilla.check();
    await dra.waitForTimeout(1000);
    await captura(dra, "ficha-cronograma", [
      { loc: casilla, n: 1 },
      { loc: dra.getByTestId("avance"), n: 2 },
    ], { sinScroll: true });
    await dra.getByRole("tab", { name: /Archivos/ }).click();
    await captura(dra, "ficha-archivos", [{ loc: dra.getByTestId("archivos-proyecto"), n: 1, margen: 2 }, { loc: tarjeta(dra, "Formulario respondido"), n: 2, margen: 2 }], { sinScroll: true });
    await dra.getByRole("tab", { name: /Historial/ }).click();
    await captura(dra, "ficha-historial", [{ loc: dra.getByTestId("historial-propuesta"), n: 1, margen: 2 }], { sinScroll: true });
    await dra.getByRole("tab", { name: /Resumen/ }).click();
    await captura(dra, "ficha-estado-notas", [
      { loc: dra.getByRole("button", { name: "Pasar a tribunal" }), n: 1 },
      { loc: dra.getByRole("button", { name: "Marcar finalizado" }), n: 2 },
      { loc: dra.getByLabel("Notas del proyecto"), n: 3 },
    ]);
    // Avance desde el celular
    const marianaPortal = await celular();
    await entrarPortal(marianaPortal, `/p/${await tokenDe(mariana.plan_id)}`, "7654321");
    await captura(marianaPortal, "est-avance", [{ loc: marianaPortal.getByTestId("avance-portal"), n: 1 }, { loc: marianaPortal.getByText(/^Este mes/), n: 2 }, { loc: marianaPortal.getByText("Próxima cuota:"), n: 3 }]);
    await marianaPortal.context().close();
    await ir(dra, "/panel/tesis/calendario");
    await dra.waitForTimeout(800);
    await captura(dra, "calendario-mes", [
      { loc: dra.getByRole("list", { name: "Leyenda de colores" }), n: 1 },
      { loc: dra.getByRole("group", { name: "Vista del calendario" }), n: 2 },
      { loc: dra.getByRole("button", { name: "Anterior" }), n: 3 },
    ], { sinScroll: true });
    await dra.getByRole("group", { name: "Vista del calendario" }).getByRole("button", { name: "Lista" }).click();
    await dra.waitForTimeout(600);
    const cobro = dra.locator(".calendario-propio").getByText(/^Cobro /).first();
    await captura(dra, "calendario-lista", [
      { loc: dra.getByRole("group", { name: "Vista del calendario" }).getByRole("button", { name: "Lista" }), n: 1 },
      { loc: cobro, n: 2, flecha: "der", texto: "Haz clic para ver el detalle" },
    ], { sinScroll: true });
    await cobro.click();
    await dra.waitForTimeout(400);
    await captura(dra, "calendario-detalle", [{ loc: dra.getByRole("link", { name: "Abrir el proyecto" }), n: 1 }], { sinScroll: true });
    await dra.keyboard.press("Escape");
  }

  // 10. Revisiones del tribunal y extras ──────────────────────────
  if (seccion("revisiones")) {
    const andrea = await proyecto("Andrea Gutiérrez Molina");
    await ir(dra, `/panel/tesis/propuestas/${andrea.id}`);
    const rev = tarjeta(dra, "Revisiones del tribunal");
    const ext = tarjeta(dra, "Extras");
    await captura(dra, "revisiones-extras", [
      { loc: rev.getByRole("button", { name: "Desmarcar" }).first(), n: 1 },
      { loc: rev.getByRole("button", { name: "Aprobar y cobrar" }), n: 2 },
      { loc: ext.getByRole("button", { name: "Aprobar y cobrar" }), n: 3 },
    ]);
    await rev.getByRole("button", { name: "Aprobar y cobrar" }).click();
    await dra.waitForTimeout(1000);
    await dra.getByRole("tab", { name: /Cuotas/ }).click();
    await captura(dra, "revisiones-cuota-agregada", [{ loc: dra.getByText("Revisión 3 del tribunal").locator("xpath=ancestor::li[1]"), n: 1 }], { sinScroll: true });
  }

  // 11. Formularios ───────────────────────────────────────────────
  if (seccion("formularios")) {
    await ir(dra, "/panel/tesis/formularios");
    await captura(dra, "formularios-lista", [{ loc: dra.getByRole("link", { name: "Nuevo formulario" }), n: 1, flecha: "izq", texto: "Crear" }], { sinScroll: true });
    await dra.getByRole("link", { name: "Nuevo formulario" }).click();
    await dra.waitForURL(/nuevo/);
    await dra.getByLabel("Nombre del formulario").fill("Datos para la encuesta");
    await dra.getByLabel("Descripción (la ve el estudiante)").fill("Cuéntanos sobre tu población de estudio.");
    await dra.getByLabel("Etiqueta").first().fill("Población de estudio");
    await dra.getByRole("button", { name: "Agregar campo" }).click();
    await dra.getByLabel("Etiqueta").nth(1).fill("Tamaño de la muestra");
    await dra.getByLabel("Tipo").nth(1).selectOption("seleccion");
    await dra.getByLabel("Opciones (una por línea)").fill("Menos de 50\nEntre 50 y 200\nMás de 200");
    await dra.getByRole("button", { name: "Agregar campo" }).click();
    await dra.getByLabel("Etiqueta").nth(2).fill("Base de datos (Excel o SPSS en ZIP)");
    await dra.getByLabel("Tipo").nth(2).selectOption("zip");
    await captura(dra, "formularios-nuevo", [
      { loc: dra.getByLabel("Nombre del formulario"), n: 1 },
      { loc: dra.getByLabel("Tipo").nth(1), n: 2 },
      { loc: dra.getByLabel("Opciones (una por línea)"), n: 3 },
      { loc: dra.getByText("Obligatorio").nth(1), n: 4 },
    ], { sinScroll: true });
    await captura(dra, "formularios-zip", [
      { loc: dra.getByLabel("Tipo").nth(2), n: 1 },
      { loc: dra.getByText("Límite: 50 MB por archivo").last(), n: 2 },
      { loc: dra.getByRole("button", { name: "Agregar campo" }), n: 3 },
      { loc: dra.getByRole("button", { name: "Guardar formulario" }), n: 4, flecha: "arriba", texto: "Guardar" },
    ]);
    await dra.getByRole("button", { name: "Guardar formulario" }).click();
    await dra.waitForURL(/formularios\/[0-9a-f-]{36}/);
    await captura(dra, "formularios-eliminar", [{ loc: dra.getByTestId("boton-eliminar"), n: 1, flecha: "abajo", texto: "Eliminar formulario" }], { sinScroll: true });
  }

  // 12. Tipo de cambio (plan en reales) ───────────────────────────
  if (seccion("cambio")) {
    const lucas = await proyecto("Lucas Almeida Souza");
    await ir(dra, `/panel/cobros/planes/${lucas.plan_id}`);
    await dra.getByRole("button", { name: "Nuevo enlace con PIN" }).click();
    await expect(dra.getByTestId("pin-portal")).toBeVisible();
    const pin = (await dra.getByTestId("pin-portal").textContent())!.trim();
    await captura(dra, "cambio-plan-brl", [
      { loc: dra.getByTestId("pin-portal").locator("xpath=ancestor::div[contains(@class,'rounded-lg')][1]"), n: 1 },
      { loc: tarjeta(dra, "Pagos"), n: 2, margen: 2 },
    ]);
    const lucasPortal = await celular();
    await entrarPortal(lucasPortal, new URL((await dra.getByTestId("url-portal").textContent())!.trim()).pathname, pin);
    await captura(lucasPortal, "est-pago-reales", [{ loc: lucasPortal.getByTestId("monto-bs").locator(".."), n: 1 }]);
    await lucasPortal.context().close();
  }

  // 13. Usuarios y roles ──────────────────────────────────────────
  if (seccion("usuarios")) {
    await ir(dra, "/panel/usuarios");
    await captura(dra, "usuarios", [
      { loc: dra.getByLabel("Rol de Carla Rivero"), n: 1 },
      { loc: dra.getByRole("button", { name: "Desactivar" }).first(), n: 2 },
      { loc: dra.getByRole("heading", { name: "Nuevo usuario" }).locator(".."), n: 3, margen: 2 },
    ], { sinScroll: true });
    await captura(dra, "usuarios-roles", [{ loc: dra.getByRole("button", { name: "Crear rol" }), n: 1 }, { loc: dra.getByRole("button", { name: "Guardar «Asistente»" }), n: 2 }], { recorte: tarjeta(dra, "Roles y permisos por módulo") });
  }

  // Problemas comunes ─────────────────────────────────────────────
  if (seccion("problemas")) {
    const cel = await celular();
    await cel.goto("/p/EnlaceQueYaNoExisteXXXXXXXXXXXXXXXXXXXXXXXXX");
    await captura(cel, "est-enlace-no-disponible", [{ loc: cel.getByText("Enlace no disponible"), n: 1 }, { loc: cel.getByTestId("boton-guia"), n: 2 }], { sinScroll: true });
    await cel.goto("/ayuda/estudiante");
    await captura(cel, "est-guia", [{ loc: cel.getByRole("navigation", { name: "Idioma / Idioma" }), n: 1 }], { sinScroll: true });
    await cel.context().close();
  }
  await db.end();
}

async function main() {
  const t0 = Date.now();
  if (!args.includes("--sin-base")) await prepararBase();
  if (!args.includes("--sin-build") || !existsSync(".next/BUILD_ID")) correr("npm run build");
  const servidor = await levantarServidor();
  nav = await chromium.launch({ args: ["--lang=es-419"] });
  try {
    await recorrido();
  } finally {
    await nav.close();
    detener(servidor);
  }
  console.log(`\n✓ ${capturasHechas.length} capturas en docs/manual/img (${Math.round((Date.now() - t0) / 1000)} s)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
