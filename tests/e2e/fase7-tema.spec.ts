import { expect, test, type Page } from "@playwright/test";
import { iniciarSesion } from "./ayudas";

const fondoCta = (p: Page) => p.getByTestId("cta-whatsapp").first().evaluate((el) => getComputedStyle(el).backgroundColor);

async function elegirYGuardar(page: Page, preset: string) {
  await page.getByTestId(`preset-${preset}`).click();
  await expect(page.getByTestId(`preset-${preset}`)).toHaveAttribute("aria-pressed", "true");
  const guardar = page.getByTestId("guardar-apariencia");
  if (await guardar.isEnabled()) {
    await guardar.click();
    await expect(page.getByText("Apariencia guardada.").first()).toBeVisible();
  }
  await expect(page.getByText("Todo guardado")).toBeVisible();
}

test.describe("Fase 7 · temas por organización y landing con movimiento", () => {
  test("cambiar el preset en Apariencia cambia el color del botón de la landing (y del portal/panel)", async ({ page, browser }) => {
    await iniciarSesion(page, "dra");
    await page.goto("/panel/configuracion/apariencia");
    await expect(page.getByRole("heading", { name: "Apariencia", level: 1 })).toBeVisible();
    await elegirYGuardar(page, "academico");

    const visitante = await browser.newPage();
    await visitante.goto("/es");
    expect(await fondoCta(visitante)).toBe("rgb(14, 74, 85)");
    // Las variables llegan en el <head> desde el servidor (sin parpadeo).
    expect(await visitante.locator("head style").allTextContents()).toContainEqual(expect.stringContaining("--color-primario:#0e4a55"));

    await elegirYGuardar(page, "vino");
    // la vista previa cambia al instante y el panel toma el primario para acentos
    await expect(page.getByTestId("vista-previa-boton")).toHaveCSS("background-color", "rgb(122, 31, 61)");
    await visitante.reload();
    expect(await fondoCta(visitante)).toBe("rgb(122, 31, 61)");
    await expect(visitante.locator("h1")).toHaveCSS("font-family", /playfair/i);

    // restaurar
    await elegirYGuardar(page, "academico");
    await visitante.reload();
    expect(await fondoCta(visitante)).toBe("rgb(14, 74, 85)");
    await visitante.close();
  });

  test("no deja guardar una combinación ilegible y ofrece una corrección", async ({ page }) => {
    await iniciarSesion(page, "dra");
    await page.goto("/panel/configuracion/apariencia");
    await page.getByLabel("Primario", { exact: true }).fill("#f2e6c9");
    await expect(page.getByRole("alert").filter({ hasText: "no se leen bien" })).toBeVisible();
    await expect(page.getByTestId("guardar-apariencia")).toBeDisabled();
    await page.getByRole("button", { name: "Usar sugerencia" }).first().click();
    await expect(page.getByTestId("guardar-apariencia")).toBeEnabled();
    await page.getByRole("button", { name: "Descartar cambios" }).click();
    await expect(page.getByText("Todo guardado")).toBeVisible();
  });

  test("landing: barra de progreso, encabezado que se esconde y botón flotante tras la portada @movil", async ({ page }) => {
    await page.goto("/es");
    const flotante = page.getByTestId("cta-fijo");
    await expect(flotante).toBeHidden();
    await page.mouse.wheel(0, 1600);
    await expect(flotante).toBeVisible();
    await expect(page.locator("header").first()).toHaveClass(/-translate-y-full/);
    await page.mouse.wheel(0, -400);
    await expect(page.locator("header").first()).not.toHaveClass(/-translate-y-full/);
    // el menú lleva con scroll suave a la sección
    await page.evaluate(() => window.scrollTo(0, 0));
    if ((page.viewportSize()?.width ?? 0) >= 768) {
      await page.getByRole("navigation", { name: "Secciones" }).getByRole("link", { name: "Preguntas" }).click();
      await expect(page).toHaveURL(/#faq$/);
      await expect(page.getByRole("heading", { name: "Preguntas frecuentes" })).toBeInViewport();
    }
  });

  test("con movimiento reducido todo el contenido se ve sin desplazamientos", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const p = await ctx.newPage();
    await p.goto("/es");
    await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(p.getByRole("heading", { name: "Preguntas frecuentes" })).toBeVisible();
    const t = await p.locator(".entrar-palabra").first().evaluate((el) => getComputedStyle(el).transform);
    expect(t === "none" || t === "matrix(1, 0, 0, 1, 0, 0)").toBe(true);
    await ctx.close();
  });
});
