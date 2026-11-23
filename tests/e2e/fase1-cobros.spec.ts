import { expect, test } from "@playwright/test";
import { iniciarSesion, unico } from "./ayudas";

test.describe("Fase 1 · Cobros de punta a punta", () => {
  test("un cliente paga una cuota: plan → enlace con CI → comprobante → aprobación", async ({ page, browser }) => {
    const id = unico();
    const ci = `9${Math.floor(Math.random() * 1e6)}`;
    await iniciarSesion(page, "dra");

    // La Dra. carga su QR estático
    await page.goto("/panel/configuracion");
    await page.getByLabel("Imagen del QR estático de cobro").setInputFiles("tests/fixtures/qr.png");
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByText("Cambios guardados.")).toBeVisible();

    // Cliente
    await page.goto("/panel/cobros/clientes");
    await page.getByRole("button", { name: "Nuevo cliente" }).first().click();
    await page.getByLabel("Nombre completo").fill(`Cliente E2E ${id}`);
    await page.getByLabel("CI", { exact: true }).fill(ci);
    await page.getByLabel("Celular WhatsApp (con código de país)").fill("59171234567");
    await page.getByRole("button", { name: "Agregar cliente" }).click();
    await expect(page.getByText("Cliente guardado.")).toBeVisible();
    await page.getByRole("link", { name: `Cliente E2E ${id}` }).click();
    await page.getByRole("link", { name: "Nuevo plan de pagos" }).click();

    // Plan con 2 cuotas, una editada a mano
    await page.getByLabel("Concepto", { exact: true }).fill(`Plan E2E ${id}`);
    await page.getByLabel("N.º de cuotas").fill("2");
    await page.getByLabel("Total (BOB)").fill("500");
    await page.getByRole("button", { name: "Generar" }).click();
    await expect(page.getByTestId("fila-cuota")).toHaveCount(2);
    await page.getByLabel("Monto cuota 2").fill("300");
    await page.getByLabel("Monto cuota 2").press("Tab");
    await expect(page.getByTestId("total-plan")).toHaveText("Bs 550,00");
    await page.getByRole("button", { name: "Crear plan" }).click();
    await expect(page).toHaveURL(/\/panel\/cobros\/planes\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { name: `Plan E2E ${id}` })).toBeVisible();

    // Enlace del portal protegido con CI
    await page.getByRole("button", { name: "Generar enlace con CI" }).click();
    const url = (await page.getByTestId("url-portal").textContent())!.trim();
    expect(url).toMatch(/\/p\/[A-Za-z0-9_-]{43}$/);

    // El cliente abre su enlace (sin sesión del panel)
    const cliente = await browser.newPage();
    await cliente.goto(new URL(url).pathname);
    await expect(cliente.getByTestId("boton-whatsapp")).toHaveCount(0);
    await cliente.getByLabel("Carnet de identidad (CI)").fill("0000");
    await cliente.getByRole("button", { name: "Entrar" }).click();
    await expect(cliente.getByText(/Dato incorrecto. Te quedan 4 intentos/)).toBeVisible();
    await cliente.getByLabel("Carnet de identidad (CI)").fill(ci);
    await cliente.getByRole("button", { name: "Entrar" }).click();
    await expect(cliente.getByTestId("monto-bs")).toHaveText("Bs 250,00");
    await expect(cliente.getByAltText("Código QR para pagar")).toBeVisible();
    await expect(cliente.getByTestId("boton-whatsapp")).toHaveCount(0);
    await cliente.getByRole("button", { name: "Ya pagué, subir comprobante" }).click();
    await cliente.getByLabel("Comprobante (foto o PDF, máx. 50 MB)").setInputFiles("tests/fixtures/comprobante.pdf");
    await cliente.getByRole("button", { name: "Enviar comprobante" }).click();
    await expect(cliente.getByText(/¡Comprobante enviado!/).first()).toBeVisible();

    // Un archivo del portal no se puede descargar sin sesión
    const anonimo = await browser.newContext();
    const r = await anonimo.request.get(`/api/archivos/00000000-0000-0000-0000-000000000000`);
    expect(r.status()).toBe(404);

    // La Dra. aprueba
    await page.goto("/panel/cobros/pagos");
    const tarjeta = page.getByTestId("comprobante-pendiente").filter({ hasText: `Cliente E2E ${id}` });
    await expect(tarjeta).toContainText("Bs 250,00");
    const enlaceComprobante = await tarjeta.getByRole("link", { name: "Ver comprobante" }).getAttribute("href");
    expect((await anonimo.request.get(enlaceComprobante!)).status()).toBe(404); // sin sesión: no accesible
    expect((await page.request.get(enlaceComprobante!)).status()).toBe(200); // con sesión del panel: sí
    await tarjeta.getByRole("button", { name: "Aprobar" }).click();
    await expect(page.getByText("Pago aprobado.")).toBeVisible();

    // El cliente ve la cuota pagada y la siguiente lista para pagar
    await cliente.reload();
    await expect(cliente.getByTestId("portal-cuota-1")).toContainText("Pagada");
    await expect(cliente.getByTestId("monto-bs")).toHaveText("Bs 300,00");
    await anonimo.close();
  });
});
