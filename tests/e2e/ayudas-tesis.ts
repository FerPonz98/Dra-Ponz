import { expect, type Page } from "@playwright/test";

export async function crearPropuesta(page: Page, id: string, ci: string, opciones: { formulario?: string } = {}) {
  await page.goto("/panel/tesis/propuestas/nueva");
  await page.getByLabel("Nombre del proyecto o tema").fill(`Tesis E2E ${id}`);
  await page.getByLabel("Nombre del estudiante").fill(`Estudiante E2E ${id}`);
  await page.getByLabel("CI del estudiante").fill(ci);
  await page.getByLabel("WhatsApp del estudiante").fill("59171112222");
  await page.getByLabel("Universidad").fill("Universidad Amazónica de Pando");
  await page.getByRole("button", { name: "Siguiente" }).click(); // moneda
  await page.getByRole("button", { name: "Siguiente" }).click(); // plan
  await page.getByLabel("N.º de cuotas").fill("3");
  await page.getByLabel("Total (BOB)").fill("3000");
  await page.getByRole("button", { name: "Generar" }).click();
  await expect(page.getByTestId("fila-cuota")).toHaveCount(3);
  await page.getByRole("button", { name: "Siguiente" }).click(); // cronograma
  await page.getByRole("button", { name: "Cargar plantilla" }).click();
  await expect(page.getByTestId("fila-actividad")).toHaveCount(9);
  await page.getByRole("button", { name: "Siguiente" }).click(); // mora
  await page.getByRole("button", { name: "Siguiente" }).click(); // revisiones
  await page.getByLabel("Precio de la 3.ª revisión (BOB)").fill("500");
  await page.getByRole("button", { name: "Siguiente" }).click(); // extras
  await expect(page.getByLabel("Extra", { exact: true }).first()).toHaveValue("Diapositivas para la sustentación");
  await page.getByRole("button", { name: "Siguiente" }).click(); // formulario
  if (opciones.formulario) await page.getByLabel("Formulario de recolección de datos").selectOption({ label: opciones.formulario });
  await page.getByRole("button", { name: "Siguiente" }).click(); // vigencia
  await page.getByLabel("Vigencia del enlace (días)").fill("7");
  await page.getByRole("button", { name: "Siguiente" }).click(); // vista previa
  await expect(page.getByTestId("total-propuesta")).toHaveText("Bs 3.000,00");
  await page.getByRole("button", { name: "Guardar propuesta" }).click();
  await expect(page).toHaveURL(/\/panel\/tesis\/propuestas\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId("estado-proyecto")).toHaveText("Borrador");
  return page.url().split("/").pop()!;
}

export async function enviarYObtenerUrl(page: Page, boton: RegExp) {
  await page.getByRole("button", { name: boton }).click();
  const url = (await page.getByTestId("url-propuesta").textContent())!.trim();
  const wa = await page.getByTestId("boton-whatsapp").first().getAttribute("href");
  expect(wa).toMatch(/^https:\/\/wa\.me\/59171112222\?text=/);
  expect(decodeURIComponent(wa!)).toContain(url);
  return new URL(url).pathname;
}

