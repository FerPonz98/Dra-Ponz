import { expect, type Page } from "@playwright/test";
import "dotenv/config";
import { Client } from "pg";

export const CRED = {
  superadmin: { correo: process.env.SUPERADMIN_EMAIL!, clave: process.env.SUPERADMIN_PASSWORD! },
  dra: { correo: process.env.DRA_EMAIL!, clave: process.env.DRA_PASSWORD! },
  demo: { correo: process.env.DEMO_EMAIL!, clave: process.env.DEMO_PASSWORD! },
};

export async function iniciarSesion(page: Page, quien: keyof typeof CRED) {
  await page.goto("/login");
  await page.getByLabel("Correo").fill(CRED[quien].correo);
  await page.getByLabel("Contraseña").fill(CRED[quien].clave);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(quien === "superadmin" ? /\/superadmin/ : /\/panel/);
}

/** Acceso directo a la BD (rol dueño) para simular el paso del tiempo en pruebas E2E. */
export async function sqlAdmin<T extends Record<string, unknown> = Record<string, unknown>>(texto: string, valores: unknown[] = []) {
  const c = new Client({ connectionString: process.env.DATABASE_ADMIN_URL });
  await c.connect();
  try {
    return (await c.query<T>(texto, valores)).rows;
  } finally {
    await c.end();
  }
}

export const unico = () => Math.random().toString(36).slice(2, 7);
