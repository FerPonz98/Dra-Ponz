import { expect, test, type Page } from "@playwright/test";
import { iniciarSesion } from "./ayudas";

const intro = (p: Page) => p.getByTestId("intro");
const conIntro = (p: Page) => p.evaluate(() => document.documentElement.classList.contains("con-intro"));

test.describe("Fase 8 · logo de la Dra. e intro animada", () => {
  test("primera visita: la intro aparece y se va sola (≤ 2,2 s); al recargar o navegar no se repite", async ({ page }) => {
    await page.goto("/es");
    await expect(intro(page)).toBeVisible();
    await expect(page.getByRole("button", { name: "Saltar" })).toBeVisible();
    const t0 = Date.now();
    await expect(intro(page)).toBeHidden({ timeout: 4000 });
    expect(Date.now() - t0).toBeLessThan(2600);
    // El logo llegó a su lugar en el encabezado y el contenido estuvo siempre en el HTML
    await expect(page.locator("[data-logo-cabecera]")).toHaveCSS("opacity", "1");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.reload();
    expect(await conIntro(page)).toBe(false);
    await expect(intro(page)).toBeHidden();
    await page.goto("/pt");
    expect(await conIntro(page)).toBe(false);
  });

  test("«Saltar», Esc y un clic la cierran al instante; en /pt dice «Pular»", async ({ browser }) => {
    for (const [ruta, forma] of [["/es", "boton"], ["/es", "esc"], ["/pt", "clic"]] as const) {
      const ctx = await browser.newContext();
      const p = await ctx.newPage();
      await p.goto(ruta);
      await expect(intro(p)).toBeVisible();
      const t0 = Date.now();
      if (forma === "boton") await p.getByRole("button", { name: "Saltar" }).click();
      else if (forma === "esc") await p.keyboard.press("Escape");
      else {
        await expect(p.getByRole("button", { name: "Pular" })).toBeVisible();
        await p.mouse.click(200, 400);
      }
      await expect(intro(p)).toBeHidden({ timeout: 1500 });
      expect(Date.now() - t0, forma).toBeLessThan(1200);
      await ctx.close();
    }
  });

  test("con movimiento reducido o para buscadores y WhatsApp no aparece (y el contenido está completo)", async ({ browser }) => {
    for (const opciones of [{ reducedMotion: "reduce" as const }, { userAgent: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" }, { userAgent: "WhatsApp/2.23.20.0 A" }]) {
      const ctx = await browser.newContext(opciones);
      const p = await ctx.newPage();
      await p.goto("/es");
      expect(await conIntro(p)).toBe(false);
      await expect(intro(p)).toBeHidden();
      await expect(p.getByRole("heading", { level: 1 })).toBeVisible();
      await ctx.close();
    }
  });

  test("la intro se puede desactivar desde Apariencia", async ({ page, browser }) => {
    await iniciarSesion(page, "dra");
    await page.goto("/panel/configuracion/apariencia");
    const interruptor = page.getByLabel("Mostrar la intro animada");
    const etiqueta = page.getByText("Mostrar la intro animada");
    await expect(interruptor).toBeChecked();
    await etiqueta.click();
    await expect(interruptor).not.toBeChecked();
    await page.getByTestId("guardar-apariencia").click();
    await expect(page.getByText("Apariencia guardada.").first()).toBeVisible();
    try {
      const v = await browser.newPage();
      await v.goto("/es");
      expect(await conIntro(v)).toBe(false);
      await v.close();
    } finally {
      await etiqueta.click();
      await expect(interruptor).toBeChecked();
      await page.getByTestId("guardar-apariencia").click();
      await expect(page.getByText("Todo guardado")).toBeVisible();
    }
  });

  test("en el celular la intro es más corta (≤ 1,6 s) @movil", async ({ page }, info) => {
    test.skip(info.project.name !== "celular", "solo en celular");
    await page.goto("/es");
    await expect(intro(page)).toBeVisible();
    const t0 = Date.now();
    await expect(intro(page)).toBeHidden({ timeout: 3000 });
    expect(Date.now() - t0).toBeLessThan(1900);
  });

  test("el logo nuevo está en la landing, el login, el panel y el portal; íconos, manifest e imagen OG", async ({ page, request }) => {
    await page.addInitScript(() => sessionStorage.setItem("jp-intro", "1"));
    await page.goto("/es");
    await expect(page.locator("header [data-logo-cabecera] svg").first()).toHaveAttribute("aria-label", /Julieta Ponz/);
    await expect(page.locator("footer svg").first()).toBeVisible();
    await page.goto("/login");
    await expect(page.locator("svg[aria-label*='Julieta Ponz']").first()).toBeAttached();
    await iniciarSesion(page, "dra");
    await expect(page.locator("svg[aria-label*='Julieta Ponz']").first()).toBeAttached();

    for (const [ruta, tipo] of [["/favicon.ico", /image\/(x-icon|vnd\.microsoft\.icon)/], ["/icon.svg", /image\/svg\+xml/], ["/apple-icon.png", /image\/png/], ["/brand/android-512.png", /image\/png/], ["/brand/logo-correo.png", /image\/png/], ["/es/opengraph-image", /image\/png/]] as const) {
      const r = await request.get(ruta);
      expect(r.status(), ruta).toBe(200);
      expect(r.headers()["content-type"], ruta).toMatch(tipo);
    }
    const m = await (await request.get("/manifest.webmanifest")).json();
    expect(m.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(m.icons.map((i: { sizes: string }) => i.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));
  });

  test("subir un SVG con script se rechaza; un SVG limpio reemplaza al logo y se puede volver al de por defecto", async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem("jp-intro", "1"));
    await iniciarSesion(page, "dra");
    await page.goto("/panel/configuracion/apariencia");
    const isotipo = page.getByTestId("marca-isotipo");
    await isotipo.locator("input[type=file]").setInputFiles({ name: "malo.svg", mimeType: "image/svg+xml", buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><path d="M0 0h1"/></svg>') });
    await isotipo.getByRole("button", { name: "Subir" }).click();
    await expect(page.getByText(/tiene scripts o eventos/)).toBeVisible();

    await isotipo.locator("input[type=file]").setInputFiles({ name: "propio.svg", mimeType: "image/svg+xml", buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><image href="https://rastreo.example/x.png"/><rect width="10" height="10" fill="#123456"/></svg>') });
    await isotipo.getByRole("button", { name: "Subir" }).click();
    await expect(page.getByText("Limpiamos tu SVG")).toBeVisible();
    // El portal y el panel usan ahora la imagen subida, servida pública y sin nada externo
    const src = await isotipo.locator("img").first().getAttribute("src");
    expect(src).toMatch(/^\/marca\/[0-9a-f-]{36}\/isotipo$/);
    const r = await page.request.get(src!);
    expect(r.headers()["content-type"]).toBe("image/svg+xml");
    expect(r.headers()["content-security-policy"]).toContain("sandbox");
    expect(await r.text()).not.toContain("rastreo.example");

    await isotipo.getByRole("button", { name: "Usar el de por defecto" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Quitar" }).click();
    await expect(page.getByText("Se restauró el valor por defecto.")).toBeVisible();
    await expect(isotipo.locator("svg[aria-label*='Julieta Ponz']").first()).toBeAttached();
  });
});
