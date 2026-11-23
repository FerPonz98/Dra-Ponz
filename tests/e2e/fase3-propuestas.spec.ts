import { expect, test } from "@playwright/test";
import { iniciarSesion, sqlAdmin, unico } from "./ayudas";
import { crearPropuesta, enviarYObtenerUrl } from "./ayudas-tesis";

test.describe("Fase 3 · propuestas de tesis", () => {
  test("crear → enviar → vencer → editar → reenviar → aceptar", async ({ page, browser, request }) => {
    const id = unico();
    const ci = `8${Math.floor(Math.random() * 1e6)}`;
    await iniciarSesion(page, "dra");
    const propuestaId = await crearPropuesta(page, id, ci);

    // PDF de la propuesta
    const pdf = await page.request.get(`/api/tesis/propuestas/${propuestaId}/pdf`);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toBe("application/pdf");
    expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");

    // Enviar
    const ruta1 = await enviarYObtenerUrl(page, /Generar enlace y enviar/);
    await page.reload();
    await expect(page.getByTestId("estado-proyecto")).toHaveText("Enviada");

    // Vence: simulamos el paso del tiempo y corre el job diario
    await sqlAdmin("update propuestas set expira_en = now() - interval '1 minute' where id = $1", [propuestaId]);
    await sqlAdmin("update enlaces_portal set expira_en = now() - interval '1 minute' where referencia_id = $1 and token is not null", [propuestaId]);
    const job = await request.post("/api/jobs/diario", { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } });
    expect(job.status()).toBe(200);
    await page.reload();
    await expect(page.getByTestId("estado-proyecto")).toHaveText("Vencida");
    const [enlace] = await sqlAdmin<{ token: string | null }>("select token from enlaces_portal where referencia_id = $1 order by creado_en desc limit 1", [propuestaId]);
    expect(enlace.token).toBeNull();
    const estudiante = await browser.newPage();
    await estudiante.goto(ruta1);
    await expect(estudiante.getByRole("heading", { name: "Enlace no disponible" })).toBeVisible();

    // Editar (cambia la 1.ª cuota) y reenviar
    await page.getByRole("link", { name: "Editar" }).click();
    await expect(page.getByText("Esta propuesta venció")).toBeVisible();
    await page.getByRole("button", { name: "3. Plan de pagos" }).click();
    await page.getByLabel("Monto cuota 1").fill("1500");
    await page.getByLabel("Monto cuota 1").press("Tab");
    await expect(page.getByTestId("total-plan")).toHaveText("Bs 3.500,00");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page).toHaveURL(new RegExp(`/panel/tesis/propuestas/${propuestaId}$`));
    const ruta2 = await enviarYObtenerUrl(page, /Reenviar con enlace nuevo/);
    expect(ruta2).not.toBe(ruta1);

    // El estudiante acepta en el enlace nuevo
    await estudiante.goto(ruta2);
    await estudiante.getByLabel("Carnet de identidad (CI)").fill(ci);
    await estudiante.getByRole("button", { name: "Entrar" }).click();
    await expect(estudiante.getByRole("heading", { name: "1. Revisa tu propuesta" })).toBeVisible();
    await expect(estudiante.getByText("Bs 3.500,00").first()).toBeVisible();
    await estudiante.getByRole("button", { name: "Acepto la propuesta" }).click();
    await estudiante.getByRole("alertdialog").getByRole("button", { name: "Sí, acepto" }).click();
    await expect(estudiante.getByTestId("aceptada-portal")).toBeVisible();
    await expect(estudiante.getByText("2. Paga la primera cuota con QR")).toBeVisible();
    await expect(estudiante.getByTestId("boton-whatsapp")).toHaveCount(0);

    await page.reload();
    await expect(page.getByTestId("aceptada-en")).toBeVisible();
    await page.getByRole("tab", { name: "Historial" }).click();
    await expect(page.getByTestId("historial-propuesta")).toContainText("Propuesta aceptada por el estudiante");
    await expect(page.getByTestId("historial-propuesta")).toContainText("Propuesta vencida");
    await expect(page.getByTestId("historial-propuesta")).toContainText("reenviada");
  });
});
