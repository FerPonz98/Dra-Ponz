import { expect, test } from "@playwright/test";
import { iniciarSesion } from "./ayudas";

test.describe("Fase 5 · landing ES/PT editable + SEO", () => {
  test("landing en español: secciones, CTA de WhatsApp arriba, a la mitad y al final; sin testimonios inventados", async ({ page }) => {
    await page.goto("/es");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tu tesis, de la idea a la defensa, con quien sabe lo que el tribunal va a observar.");
    for (const t of ["¿Te pasa esto?", "Servicios", "Cómo trabajamos", "Pago en cuotas", "Por qué con la Dra. Ponz", "Trayectoria", "Preguntas frecuentes", "Tu defensa empieza con una conversación."]) {
      await expect(page.getByRole("heading", { name: t })).toBeVisible();
    }
    await expect(page.getByRole("heading", { name: "Testimonios" })).toHaveCount(0);
    const ctas = page.getByTestId("cta-whatsapp");
    await expect(ctas).toHaveCount(4);
    await expect(ctas.first()).toHaveText(/Quiero un diagnóstico de mi tesis/);
    expect(await ctas.first().getAttribute("href")).toMatch(/^https:\/\/wa\.me\/\d+\?text=Hola%20Dra\.%20Ponz/);
    await expect(page.getByText("No tienes que hacerlo solo. Lo hacemos con un plan.")).toBeVisible();
    await expect(page.locator('link[rel="alternate"][hreflang="pt"]')).toHaveAttribute("href", /\/pt$/);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /29 años/);
    await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
  });

  test("versión PT y selector de idioma; CTA fijo en el celular @movil", async ({ page }, info) => {
    await page.goto("/es");
    await page.getByRole("link", { name: "PT", exact: true }).click();
    await expect(page).toHaveURL(/\/pt$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sua tese, da ideia à defesa, com quem sabe o que a banca vai observar.");
    await expect(page.getByTestId("cta-whatsapp").first()).toHaveText(/Quero um diagnóstico da minha tese/);
    if (info.project.name === "celular") {
      // El botón flotante aparece después de la portada.
      await expect(page.getByTestId("cta-fijo")).toBeHidden();
      await page.mouse.wheel(0, 1400);
      await expect(page.getByTestId("cta-fijo")).toBeVisible();
      await expect(page.getByTestId("cta-fijo")).toHaveText(/Fale comigo pelo WhatsApp/);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    } else {
      await expect(page.getByTestId("cta-fijo")).toBeHidden();
    }
  });

  test("sitemap, robots, imagen OG y raíz según idioma", async ({ request, browser }) => {
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).toContain("/es</loc>");
    expect(sitemap).toContain("/pt</loc>");
    expect(sitemap).toContain('hreflang="pt"');
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toMatch(/Disallow: \/panel/);
    expect(robots).toMatch(/Sitemap: .*\/sitemap\.xml/);
    const og = await request.get("/es/opengraph-image");
    expect(og.headers()["content-type"]).toBe("image/png");
    const pt = await browser.newContext({ locale: "pt-BR", extraHTTPHeaders: { "Accept-Language": "pt-BR,pt;q=0.9" } });
    const p = await pt.newPage();
    await p.goto("/");
    await expect(p).toHaveURL(/\/pt$/);
    await pt.close();
  });

  test("todo el texto es editable desde el panel (y los testimonios aparecen solo si se cargan)", async ({ page, browser }) => {
    await iniciarSesion(page, "dra");
    await page.goto("/panel/tesis/landing?idioma=es");
    const cierre = page.locator('[id="problemas.cierre"]');
    const original = await cierre.inputValue();
    await cierre.fill("Texto editado desde el panel E2E.");
    await page.locator('[id="testimonios.items"]').fill("Me ayudó a ordenar mi tesis | Estudiante de prueba E2E");
    await page.getByRole("button", { name: "Guardar textos (ES)" }).click();
    await expect(page.getByText("Textos guardados.")).toBeVisible();

    const visitante = await browser.newPage();
    await visitante.goto("/es");
    await expect(visitante.getByText("Texto editado desde el panel E2E.")).toBeVisible();
    await expect(visitante.getByRole("heading", { name: "Testimonios" })).toBeVisible();

    // restaurar
    await cierre.fill(original);
    await page.locator('[id="testimonios.items"]').fill("");
    await page.getByRole("button", { name: "Guardar textos (ES)" }).click();
    await expect(page.getByRole("button", { name: "Guardar textos (ES)" })).toBeEnabled();
    await expect(async () => {
      await visitante.reload();
      await expect(visitante.getByText(original)).toBeVisible({ timeout: 1000 });
      await expect(visitante.getByRole("heading", { name: "Testimonios" })).toHaveCount(0, { timeout: 1000 });
    }).toPass({ timeout: 15_000 });
  });
});
