import { expect, test } from "@playwright/test";
import { iniciarSesion, sqlAdmin, unico } from "./ayudas";

test.describe("Núcleo · usuarios y roles con permisos por módulo", () => {
  test.afterAll(async () => {
    await sqlAdmin("delete from usuarios where correo like 'asistente-e2e-%@example.com'");
    await sqlAdmin("delete from roles where nombre like 'Solo cobros %'");
  });

  test("la Dra. crea un rol solo con cobros y un usuario con ese rol; el usuario no ve Tesis", async ({ page, browser }) => {
    const id = unico();
    await iniciarSesion(page, "dra");
    await page.goto("/panel/usuarios");
    await page.getByLabel("Nuevo rol").fill(`Solo cobros ${id}`);
    await page.getByRole("button", { name: "Crear rol" }).click();
    await expect(page.getByRole("button", { name: `Guardar «Solo cobros ${id}»` })).toBeVisible();
    await page.getByLabel(`Solo cobros ${id}: Ver cobros`).check();
    await page.getByRole("button", { name: `Guardar «Solo cobros ${id}»` }).click();
    await expect(page.getByText("Rol guardado.")).toBeVisible();

    const correo = `asistente-e2e-${id}@example.com`;
    await page.getByLabel("Nombre", { exact: true }).fill(`Asistente ${id}`);
    await page.getByLabel("Correo", { exact: true }).fill(correo);
    await page.getByLabel("Contraseña inicial").fill("ClaveSegura123");
    await page.getByLabel("Rol", { exact: true }).selectOption({ label: `Solo cobros ${id}` });
    await page.getByRole("button", { name: "Crear usuario" }).click();
    await expect(page.getByText("Usuario creado.")).toBeVisible();

    const otra = await browser.newPage();
    await otra.goto("/login");
    await otra.getByLabel("Correo").fill(correo);
    await otra.getByLabel("Contraseña").fill("ClaveSegura123");
    await otra.getByRole("button", { name: "Ingresar" }).click();
    await expect(otra).toHaveURL(/\/panel/);
    await expect(otra.getByRole("link", { name: "Clientes" })).toBeVisible();
    await expect(otra.getByRole("link", { name: "Propuestas y proyectos" })).toHaveCount(0);
    await expect(otra.getByRole("link", { name: "Usuarios y roles" })).toHaveCount(0);
    await otra.goto("/panel/tesis/propuestas");
    await expect(otra.getByText("Acceso no permitido")).toBeVisible();
    await otra.goto("/panel/cobros/plantillas"); // requiere cobros:editar
    await expect(otra.getByText("Acceso no permitido")).toBeVisible();
  });
});
