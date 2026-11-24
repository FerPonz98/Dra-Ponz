// Eliminar (plan, propuesta, cliente, formulario), foto de la landing y cambiar contraseña desde «Mi cuenta».
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { iniciarSesion, sqlAdmin, unico } from "./ayudas";
import { cerrarPools, entrarPortal, planConPortal } from "./ayudas-seguridad";
import { crearPropuesta } from "./ayudas-tesis";

test.describe.configure({ mode: "serial" });
test.afterAll(async () => cerrarPools());

const dirSubidas = () => {
  const d = process.env.UPLOAD_DIR ?? "./.data/uploads";
  return isAbsolute(d) ? d : resolve(d);
};
const confirmarEliminar = async (page: import("@playwright/test").Page) => {
  await page.getByTestId("boton-eliminar").click();
  await page.getByRole("button", { name: "Sí, eliminar" }).click();
};

test.describe("Fase 9 · eliminar, foto de la landing y contraseña", () => {
  test("eliminar un plan borra cuotas, pagos y el comprobante del disco; el cliente queda", async ({ page, browser }) => {
    const p = await planConPortal("dra-ponz", `eliminar ${unico()}`);
    const portal = await browser.newPage();
    await entrarPortal(portal, p.token, p.ci);
    await portal.getByRole("button", { name: "Ya pagué, subir comprobante" }).click();
    await portal.locator("input[type=file]").first().setInputFiles({ name: "comprobante.pdf", mimeType: "application/pdf", buffer: readFileSync("tests/fixtures/comprobante.pdf") });
    await portal.getByRole("button", { name: "Enviar comprobante" }).click();
    await expect(portal.getByRole("status").filter({ hasText: /omprobante/ }).first()).toBeVisible();
    await portal.close();
    const [arch] = await sqlAdmin<{ id: string; ruta_relativa: string }>("select id, ruta_relativa from archivos where enlace_id = $1", [p.enlaceId]);
    expect(existsSync(join(dirSubidas(), arch.ruta_relativa))).toBe(true);

    await iniciarSesion(page, "dra");
    await page.goto(`/panel/cobros/planes/${p.planId}`);
    await confirmarEliminar(page);
    await expect(page).toHaveURL(/\/panel\/cobros\/planes\?eliminado=1/);
    await expect(page.getByText("Plan de pagos eliminado.")).toBeVisible();
    expect(await sqlAdmin("select 1 from planes_pago where id = $1", [p.planId])).toHaveLength(0);
    expect(await sqlAdmin("select 1 from cuotas where plan_id = $1", [p.planId])).toHaveLength(0);
    expect(await sqlAdmin("select 1 from archivos where id = $1", [arch.id])).toHaveLength(0);
    expect(existsSync(join(dirSubidas(), arch.ruta_relativa))).toBe(false);
    expect(await sqlAdmin("select 1 from clientes where id = $1", [p.clienteId])).toHaveLength(1);
    // Y ahora el cliente (ya sin planes)
    await page.goto(`/panel/cobros/clientes/${p.clienteId}`);
    await confirmarEliminar(page);
    await expect(page).toHaveURL(/\/panel\/cobros\/clientes\?eliminado=1/);
    expect(await sqlAdmin("select 1 from clientes where id = $1", [p.clienteId])).toHaveLength(0);
  });

  test("un plan de tesis no se borra desde Cobros; la propuesta sí, con su plan; el estudiante se borra con sus propuestas", async ({ page }) => {
    await iniciarSesion(page, "dra");
    const id = unico();
    const propuestaId = await crearPropuesta(page, id, `7${Math.floor(1e6 + Math.random() * 8e6)}`);
    const [pr] = await sqlAdmin<{ plan_id: string; cliente_id: string }>("select plan_id, cliente_id from propuestas where id = $1", [propuestaId]);
    await page.goto(`/panel/cobros/planes/${pr.plan_id}`);
    await expect(page.getByTestId("boton-eliminar")).toHaveCount(0);

    await page.goto(`/panel/tesis/propuestas/${propuestaId}`);
    await confirmarEliminar(page);
    await expect(page).toHaveURL(/\/panel\/tesis\/propuestas\?eliminado=1/);
    expect(await sqlAdmin("select 1 from propuestas where id = $1", [propuestaId])).toHaveLength(0);
    expect(await sqlAdmin("select 1 from planes_pago where id = $1", [pr.plan_id])).toHaveLength(0);
    expect(await sqlAdmin("select 1 from clientes where id = $1", [pr.cliente_id])).toHaveLength(1);
    await sqlAdmin("delete from clientes where id = $1", [pr.cliente_id]); // no dejar datos de prueba

    // Otra propuesta del mismo tipo y se elimina al estudiante directamente: arrastra la propuesta y su plan.
    const otra = await crearPropuesta(page, `${id}b`, `7${Math.floor(1e6 + Math.random() * 8e6)}`);
    const [o] = await sqlAdmin<{ plan_id: string; cliente_id: string }>("select plan_id, cliente_id from propuestas where id = $1", [otra]);
    await page.goto(`/panel/cobros/clientes/${o.cliente_id}`);
    await confirmarEliminar(page);
    await expect(page).toHaveURL(/eliminado=1/);
    expect(await sqlAdmin("select 1 from propuestas where id = $1", [otra])).toHaveLength(0);
    expect(await sqlAdmin("select 1 from planes_pago where id = $1", [o.plan_id])).toHaveLength(0);
  });

  test("eliminar un comprobante aprobado: la cuota vuelve a pendiente y el archivo se borra del disco", async ({ page, browser }) => {
    const p = await planConPortal("dra-ponz", `comprobante ${unico()}`);
    const portal = await browser.newPage();
    await entrarPortal(portal, p.token, p.ci);
    await portal.getByRole("button", { name: "Ya pagué, subir comprobante" }).click();
    await portal.locator("input[type=file]").first().setInputFiles({ name: "comprobante.pdf", mimeType: "application/pdf", buffer: readFileSync("tests/fixtures/comprobante.pdf") });
    await portal.getByRole("button", { name: "Enviar comprobante" }).click();
    await expect(portal.getByRole("status").filter({ hasText: /omprobante/ }).first()).toBeVisible();
    await portal.close();
    const [pago] = await sqlAdmin<{ id: string; ruta: string }>("select p.id, a.ruta_relativa as ruta from pagos p join archivos a on a.id = p.comprobante_archivo_id where p.plan_id = $1", [p.planId]);

    await iniciarSesion(page, "dra");
    await page.goto("/panel/cobros/pagos");
    const tarjeta = page.getByTestId("comprobante-pendiente").filter({ hasText: p.nombre });
    await tarjeta.getByRole("button", { name: "Aprobar" }).click();
    await expect(page).toHaveURL(/hecho=aprobado/);
    expect((await sqlAdmin<{ estado: string }>("select estado from cuotas where id = $1", [p.cuotaIds[0]]))[0].estado).toBe("pagada");

    await page.goto(`/panel/cobros/planes/${p.planId}`);
    await page.getByRole("button", { name: "Eliminar comprobante" }).click();
    await page.getByRole("button", { name: "Sí, eliminar" }).click();
    await expect(page.getByText("Comprobante eliminado.")).toBeVisible();
    await expect(page.getByText("Todavía no hay pagos registrados.")).toBeVisible();
    expect(await sqlAdmin("select 1 from pagos where id = $1", [pago.id])).toHaveLength(0);
    expect((await sqlAdmin<{ estado: string; pagada_en: Date | null }>("select estado, pagada_en from cuotas where id = $1", [p.cuotaIds[0]]))[0]).toMatchObject({ estado: "pendiente", pagada_en: null });
    expect(existsSync(join(dirSubidas(), pago.ruta))).toBe(false);
  });

  test("eliminar desde el menú ⋯ de la lista de planes y de clientes", async ({ page }) => {
    const p = await planConPortal("dra-ponz", `lista ${unico()}`);
    await iniciarSesion(page, "dra");
    await page.goto("/panel/cobros/planes");
    await page.getByLabel("Buscar por concepto o cliente").fill(p.nombre);
    await page.getByRole("button", { name: "Más acciones" }).locator("visible=true").first().click();
    await page.getByRole("menuitem", { name: "Eliminar plan" }).click();
    await page.getByRole("button", { name: "Sí, eliminar" }).click();
    await expect(page).toHaveURL(/\/panel\/cobros\/planes\?eliminado=1/);
    expect(await sqlAdmin("select 1 from planes_pago where id = $1", [p.planId])).toHaveLength(0);

    await page.goto("/panel/cobros/clientes");
    await page.getByLabel("Buscar por nombre, CI, celular o correo").fill(p.nombre);
    await page.getByRole("button", { name: "Más acciones" }).locator("visible=true").first().click();
    await page.getByRole("menuitem", { name: "Eliminar cliente" }).click();
    await page.getByRole("button", { name: "Sí, eliminar" }).click();
    await expect(page).toHaveURL(/\/panel\/cobros\/clientes\?eliminado=1/);
    expect(await sqlAdmin("select 1 from clientes where id = $1", [p.clienteId])).toHaveLength(0);
  });

  test("eliminar un formulario", async ({ page }) => {
    await iniciarSesion(page, "dra");
    await page.goto("/panel/tesis/formularios/nuevo");
    const nombre = `Formulario E2E ${unico()}`;
    await page.getByLabel("Nombre del formulario").fill(nombre);
    await page.getByLabel("Etiqueta").first().fill("Carrera");
    await page.getByRole("button", { name: "Guardar formulario" }).click();
    await expect(page).toHaveURL(/formularios\/[0-9a-f-]{36}/);
    await confirmarEliminar(page);
    await expect(page).toHaveURL(/formularios\?eliminado=1/);
    expect(await sqlAdmin("select 1 from formularios where nombre = $1", [nombre])).toHaveLength(0);
  });

  test("foto de la landing: se sube desde el panel, se optimiza a WEBP, aparece en la página y se puede quitar", async ({ page, request }) => {
    await iniciarSesion(page, "dra");
    await page.goto("/panel/tesis/landing");
    const png = readFileSync("public/brand/isotipo-512.png");
    await page.getByLabel(/Elegir la foto|Cambiar la foto/).setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: png });
    await page.getByRole("button", { name: "Subir foto" }).click();
    await expect(page.getByAltText("Foto actual de la portada")).toBeVisible();
    const src = await page.getByAltText("Foto actual de la portada").getAttribute("src");
    const r = await request.get(src!);
    expect(r.status()).toBe(200);
    expect(r.headers()["content-type"]).toBe("image/webp");
    await page.goto("/es");
    await expect(page.locator(`img[src^="/marca/"][src*="/foto"]`).first()).toBeVisible();
    // Un archivo que no es imagen se rechaza
    await page.goto("/panel/tesis/landing");
    await page.getByLabel(/Cambiar la foto/).setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: Buffer.from("no soy una imagen") });
    await page.getByRole("button", { name: "Subir foto" }).click();
    await expect(page.getByText(/no corresponde|no es válid|tipo|imagen/i).first()).toBeVisible();
    // Quitarla
    await page.getByRole("button", { name: "Quitar foto" }).click();
    await page.getByRole("button", { name: "Quitar", exact: true }).click();
    await expect(page.getByLabel("Elegir la foto")).toBeVisible();
    expect((await request.get(src!)).status()).toBe(404);
  });

  test("cambiar la contraseña desde Mi cuenta (sin correo)", async ({ page, browser }) => {
    const correo = `clave-e2e-${unico()}@example.com`;
    const clave = `Inicial-${unico()}-2026`;
    const nueva = `Nueva-${unico()}-2026`;
    await iniciarSesion(page, "dra");
    await page.goto("/panel/usuarios");
    await page.getByLabel("Nombre", { exact: true }).fill("Usuario E2E clave");
    await page.getByLabel("Correo", { exact: true }).fill(correo);
    await page.getByLabel("Contraseña inicial").fill(clave);
    await page.getByRole("button", { name: "Crear usuario" }).click();
    await expect(page.getByText(correo)).toBeVisible();

    const otro = await (await browser.newContext()).newPage();
    try {
      await otro.goto("/login");
      await otro.getByLabel("Correo").fill(correo);
      await otro.getByLabel("Contraseña").fill(clave);
      await otro.getByRole("button", { name: "Ingresar" }).click();
      await otro.waitForURL(/\/panel/);
      await otro.goto("/panel/cuenta");
      await otro.getByLabel("Contraseña actual").fill("equivocada-123");
      await otro.getByLabel("Nueva contraseña", { exact: true }).fill(nueva);
      await otro.getByLabel("Repite la nueva contraseña").fill(nueva);
      await otro.getByRole("button", { name: "Cambiar contraseña" }).click();
      await expect(otro.getByText("La contraseña actual no es correcta.")).toBeVisible();
      await otro.getByLabel("Contraseña actual").fill(clave);
      await otro.getByRole("button", { name: "Cambiar contraseña" }).click();
      await expect(otro.getByText(/tu contraseña cambió/)).toBeVisible();
      // Entra con la nueva (nueva sesión)
      const tercero = await (await browser.newContext()).newPage();
      await tercero.goto("/login");
      await tercero.getByLabel("Correo").fill(correo);
      await tercero.getByLabel("Contraseña").fill(nueva);
      await tercero.getByRole("button", { name: "Ingresar" }).click();
      await tercero.waitForURL(/\/panel/);
    } finally {
      await sqlAdmin("delete from usuarios where correo = $1", [correo]);
    }
  });

  test("recuperar contraseña avisa si el correo no está configurado", async ({ page }) => {
    await page.goto("/recuperar");
    const configurado = !!(process.env.RESEND_API_KEY || process.env.SMTP_HOST);
    await expect(page.getByText("El envío de correos no está activado")).toHaveCount(configurado ? 0 : 1);
  });
});
