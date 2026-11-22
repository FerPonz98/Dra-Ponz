import { expect, test } from "@playwright/test";
import { iniciarSesion } from "./ayudas";

test.describe("Fase 0 · login y núcleo", () => {
  test("sin sesión, el panel redirige al login", async ({ page }) => {
    await page.goto("/panel");
    await expect(page).toHaveURL(/\/login/);
  });

  test("contraseña incorrecta muestra un error genérico", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Correo").fill("dra@julietaponz.com");
    await page.getByLabel("Contraseña").fill("incorrecta-123");
    await page.getByRole("button", { name: "Ingresar" }).click();
    await expect(page.getByText("Correo o contraseña incorrectos.")).toBeVisible();
  });

  test("superadmin ve las organizaciones del seed", async ({ page }) => {
    await iniciarSesion(page, "superadmin");
    await expect(page.getByTestId("org-dra-ponz")).toBeVisible();
    await expect(page.getByTestId("org-demo-dentista")).toBeVisible();
  });

  test("la Dra. entra a su panel con cobros y tesis @movil", async ({ page }) => {
    await iniciarSesion(page, "dra");
    await expect(page.getByRole("heading", { name: /Hola/ })).toBeVisible();
    await expect(page.getByText("Módulos activos: cobros, tesis")).toBeVisible();
  });

  test("Demo Dentista solo tiene cobros y no puede entrar a tesis", async ({ page }) => {
    await iniciarSesion(page, "demo");
    await expect(page.getByText("Módulos activos: cobros")).toBeVisible();
    await page.goto("/panel/tesis/propuestas");
    await expect(page.getByText(/Acceso no permitido|no encontrada/)).toBeVisible();
  });

  test("un usuario de organización no entra al superadmin", async ({ page }) => {
    await iniciarSesion(page, "dra");
    await page.goto("/superadmin");
    await expect(page.getByText("Acceso no permitido")).toBeVisible();
  });
});
