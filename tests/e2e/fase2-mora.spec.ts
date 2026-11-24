import { expect, test } from "@playwright/test";
import { iniciarSesion, unico } from "./ayudas";

test.describe("Fase 2 · mora, recordatorios, plantillas y jobs", () => {
  test("los jobs exigen CRON_SECRET y corren con él (tipo de cambio + mora)", async ({ request }) => {
    expect((await request.post("/api/jobs/diario")).status()).toBe(401);
    expect((await request.post("/api/jobs/tipo-cambio", { headers: { Authorization: "Bearer incorrecto" } })).status()).toBe(401);
    const h = { Authorization: `Bearer ${process.env.CRON_SECRET}` };
    const tc = await request.post("/api/jobs/tipo-cambio", { headers: h });
    expect([200, 502]).toContain(tc.status()); // 502 = BCB no respondió: queda alerta y se usa la última cotización
    const d = await request.post("/api/jobs/diario", { headers: h });
    expect(d.status()).toBe(200);
    expect((await d.json()).ok).toBe(true);
  });

  test("cuota vencida aparece para recordar hoy con botón de WhatsApp y mensaje listo @movil", async ({ page }) => {
    const id = unico();
    await iniciarSesion(page, "dra");
    await page.goto("/panel/cobros/clientes");
    await page.getByRole("button", { name: "Nuevo cliente" }).first().click();
    await page.getByLabel("Nombre completo").fill(`Moroso ${id}`);
    await page.getByLabel("Celular WhatsApp (con código de país)").fill("59170000001");
    await page.getByRole("button", { name: "Agregar cliente" }).click();
    // La lista pagina de a 15: se busca por nombre para no depender de cuántos clientes haya.
    await page.getByLabel("Buscar por nombre, CI, celular o correo").fill(`Moroso ${id}`);
    await page.getByRole("link", { name: `Moroso ${id}` }).click();
    await page.getByRole("link", { name: "Nuevo plan de pagos" }).click();
    await page.getByLabel("Concepto", { exact: true }).fill(`Mora ${id}`);
    await page.getByLabel("N.º de cuotas").fill("1");
    await page.getByLabel("Total (BOB)").fill("100");
    await page.getByLabel("1.ª fecha").fill("2020-01-01");
    await page.getByRole("button", { name: "Generar" }).click();
    await page.getByLabel("Aplicar recargo por mora").check();
    await page.getByLabel("Recargo (%)").fill("10");
    await page.getByRole("button", { name: "Crear plan" }).click();
    await expect(page).toHaveURL(/\/panel\/cobros\/planes\//);
    await expect(page.getByText("En cola", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Bs 10,00").first()).toBeVisible(); // recargo único del 10 %

    await page.goto("/panel/cobros/recordatorios");
    const fila = page.getByTestId("grupo-en_cola").locator("li", { hasText: `Moroso ${id}` });
    const wa = fila.getByTestId("boton-whatsapp");
    await expect(wa).toBeVisible();
    const href = await wa.getAttribute("href");
    expect(href).toMatch(/^https:\/\/wa\.me\/59170000001\?text=/);
    expect(decodeURIComponent(href!.split("text=")[1])).toContain(`Hola Moroso`);
  });

  test("las plantillas son editables y el botón de WhatsApp no existe sin sesión", async ({ page, browser }) => {
    await iniciarSesion(page, "dra");
    await page.goto("/panel/cobros/plantillas");
    const t = page.getByLabel("Plantilla recordatorio");
    const original = await t.inputValue();
    await t.fill(`${original} ¡Gracias!`);
    await page.getByRole("button", { name: "Guardar" }).nth(1).click();
    await expect(page.getByText("Plantilla guardada.")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Plantilla recordatorio")).toHaveValue(`${original} ¡Gracias!`);
    await page.getByLabel("Plantilla recordatorio").fill(original);
    await page.getByRole("button", { name: "Guardar" }).nth(1).click();

    const anonimo = await browser.newPage();
    for (const ruta of ["/panel/cobros/recordatorios", "/panel/cobros/planes"]) {
      await anonimo.goto(ruta);
      await expect(anonimo).toHaveURL(/\/login/);
      await expect(anonimo.getByTestId("boton-whatsapp")).toHaveCount(0);
    }
  });
});
