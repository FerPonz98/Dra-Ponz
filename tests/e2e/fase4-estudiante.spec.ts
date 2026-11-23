import { writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { iniciarSesion, unico } from "./ayudas";
import { crearPropuesta, enviarYObtenerUrl } from "./ayudas-tesis";

test.describe("Fase 4 · portal del estudiante completo", () => {
  test("formulario con archivos → propuesta → aceptar → pagar → formulario → archivos → extras → avance @movil", async ({ page, browser }, info) => {
    test.skip(info.project.name === "celular", "El flujo completo corre en escritorio; en celular se revisa el portal más abajo");
    const id = unico();
    const ci = `7${Math.floor(Math.random() * 1e6)}`;
    await iniciarSesion(page, "dra");

    // 1) La Dra. crea un formulario reutilizable
    await page.goto("/panel/tesis/formularios/nuevo");
    await page.getByLabel("Nombre del formulario").fill(`Formulario E2E ${id}`);
    await page.getByLabel("Etiqueta").first().fill("Carrera");
    const agregar = page.getByRole("button", { name: "Agregar campo" });
    await agregar.click();
    await page.getByLabel("Etiqueta").nth(1).fill("Enfoque");
    await page.getByLabel("Tipo").nth(1).selectOption("seleccion");
    await page.getByLabel("Opciones (una por línea)").fill("Cuantitativo\nCualitativo");
    await agregar.click();
    await page.getByLabel("Etiqueta").nth(2).fill("Perfil de investigación");
    await page.getByLabel("Tipo").nth(2).selectOption("archivo");
    await page.getByLabel("Obligatorio").nth(2).check();
    await agregar.click();
    await page.getByLabel("Etiqueta").nth(3).fill("Base de datos");
    await page.getByLabel("Tipo").nth(3).selectOption("zip");
    await page.getByRole("button", { name: "Guardar formulario" }).click();
    await expect(page).toHaveURL(/\/panel\/tesis\/formularios\/[0-9a-f-]{36}$/);
    await expect(page.getByTestId("campo-formulario")).toHaveCount(4);

    // 2) Propuesta con ese formulario, enviada con CI
    const propuestaId = await crearPropuesta(page, id, ci, { formulario: `Formulario E2E ${id}` });
    const ruta = await enviarYObtenerUrl(page, /Generar enlace y enviar/);

    // 3) Estudiante: acepta y paga la 1.ª cuota
    const est = await browser.newPage();
    est.on("dialog", (d) => d.accept());
    await est.goto(ruta);
    await est.getByLabel("Carnet de identidad (CI)").fill(ci);
    await est.getByRole("button", { name: "Entrar" }).click();
    await est.getByRole("button", { name: "Acepto la propuesta" }).click();
    await expect(est.getByTestId("aceptada-portal")).toBeVisible();
    await expect(est.getByTestId("monto-bs")).toHaveText("Bs 1.000,00");
    await est.getByLabel("Comprobante (foto o PDF, máx. 50 MB)").setInputFiles("tests/fixtures/comprobante.pdf");
    await est.getByRole("button", { name: "Enviar comprobante" }).click();
    await expect(est.getByText("¡Comprobante enviado!")).toBeVisible();

    // La Dra. aprueba → proyecto "Aceptada"
    await page.goto("/panel/cobros/pagos");
    await page.getByTestId("comprobante-pendiente").filter({ hasText: `Estudiante E2E ${id}` }).getByRole("button", { name: "Aprobar" }).click();
    await expect(page.getByText("Pago aprobado.")).toBeVisible();
    await page.goto(`/panel/tesis/propuestas/${propuestaId}`);
    // aceptada → en curso en cuanto empieza el cronograma (hoy)
    await expect(page.getByTestId("estado-proyecto")).toHaveText(/Aceptada|En curso/);

    // 4) Formulario (con archivo PDF y ZIP)
    await est.reload();
    await expect(est.getByTestId("estado-portal")).toHaveText(/Aceptada|En curso/);
    await est.getByLabel("Carrera").fill("Bioquímica");
    await est.getByLabel("Enfoque").selectOption("Cualitativo");
    await est.getByLabel("Perfil de investigación *").setInputFiles("tests/fixtures/comprobante.pdf");
    await est.getByLabel("Base de datos").setInputFiles("tests/fixtures/datos.zip");
    await est.getByRole("button", { name: "Enviar formulario" }).click();
    await expect(est.getByText("Formulario enviado. ¡Gracias!")).toBeVisible();

    // 5) Subir archivos: 51 MB rechazado, ZIP aceptado
    const grande = info.outputPath("grande.zip");
    writeFileSync(grande, Buffer.alloc(51 * 1024 * 1024, 0x50));
    await est.getByLabel("Archivos (PDF, Word, Excel o ZIP; máx. 50 MB c/u)").setInputFiles(grande);
    await est.getByRole("button", { name: "Subir archivos" }).click();
    await expect(est.getByText(/supera el límite de 50 MB/)).toBeVisible({ timeout: 30_000 });
    await est.getByLabel("Archivos (PDF, Word, Excel o ZIP; máx. 50 MB c/u)").setInputFiles("tests/fixtures/datos.zip");
    await est.getByLabel("Descripción (opcional)").fill("Encuestas aplicadas");
    await est.getByRole("button", { name: "Subir archivos" }).click();
    await expect(est.getByText("Archivos subidos.")).toBeVisible();
    await est.reload();
    await expect(est.getByTestId("archivos-portal")).toContainText("datos.zip");
    // el estudiante puede descargar sus archivos; un visitante sin sesión no
    const href = await est.getByTestId("archivos-portal").getByRole("link").first().getAttribute("href");
    expect((await est.request.get(href!)).status()).toBe(200);
    const anon = await browser.newContext();
    expect((await anon.request.get(href!)).status()).toBe(404);
    await anon.close();

    // 6) Pide la 3.ª revisión y las diapositivas
    await est.getByRole("button", { name: "Pedir 3.ª revisión" }).click();
    await expect(est.getByText("3.ª revisión del tribunal: solicitada")).toBeVisible();
    await est.getByRole("button", { name: /Pedir diapositivas/ }).click();
    await expect(est.getByText("Diapositivas para la sustentación: solicitado")).toBeVisible();

    // 7) La Dra. ve archivos y respuestas, marca actividades y aprueba la 3.ª revisión
    await page.reload();
    await expect(page.getByTestId("archivos-proyecto")).toContainText("datos.zip");
    await expect(page.getByTestId("archivos-proyecto")).toContainText("Perfil de investigación");
    await expect(page.getByText("Formulario respondido")).toBeVisible();
    await page.getByLabel('Marcar "Revisión bibliográfica" como hecha').check();
    await page.getByLabel('Marcar "Elaboración del perfil de investigación" como hecha').check();
    await expect(page.getByTestId("avance")).toContainText("22%");
    await page.getByRole("button", { name: "Aprobar y cobrar" }).first().click();
    await expect(page.getByText("Revisión 3")).toBeVisible();

    // 8) El estudiante ve su avance, el mes en curso y la próxima cuota
    await est.reload();
    await expect(est.getByTestId("avance-portal")).toHaveText("22% completado");
    await expect(est.getByText(/Próxima cuota:/)).toBeVisible();
    await expect(est.getByText("3.ª revisión del tribunal: aprobada")).toBeVisible();
    await expect(est.getByTestId("boton-whatsapp")).toHaveCount(0);
    // captura de revisión manual del portal con sesión, en celular
    await est.setViewportSize({ width: 375, height: 812 });
    await est.screenshot({ path: "revisiones/fase-4/portal-estudiante-con-sesion-movil.png", fullPage: true });
    expect(await est.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);

    // 9) Calendario de la Dra.
    await page.goto("/panel/tesis/calendario");
    await expect(page.getByTestId("calendario")).toBeVisible();
    // con muchos eventos el día de hoy, FullCalendar agrupa el resto en "+N más"
    await expect(page.getByTestId("calendario").getByText(/Cobro Estudiante · cuota|Estudiante: Revisión bibliográfica|más/).first()).toBeVisible();
    await page.getByTestId("calendario").getByText("Semana", { exact: true }).click();
    await expect(page.getByTestId("calendario").getByText(/Estudiante|más/).first()).toBeVisible();
  });

  test("sin desbordes horizontales en 375 px @movil", async ({ page }, info) => {
    test.skip(info.project.name !== "celular", "solo en celular");
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "Ingresar" })).toBeVisible();
    const ancho = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(ancho).toBeLessThanOrEqual(375);
  });
});
