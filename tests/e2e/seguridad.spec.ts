// Auditoría de seguridad a nivel HTTP (servidor de producción local). Complementa tests/unit/seguridad.test.ts.
import { readFileSync } from "node:fs";
import { expect, test, type APIRequestContext, type Browser } from "@playwright/test";
import { CRED, iniciarSesion, sqlAdmin } from "./ayudas";
import { cerrarPools, entrarPortal, planConPortal } from "./ayudas-seguridad";

const PDF = readFileSync("tests/fixtures/comprobante.pdf");
const EXE = Buffer.concat([Buffer.from("MZ"), Buffer.alloc(2000, 0x90)]);
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script></svg>');

test.describe.configure({ mode: "serial" });
test.afterAll(async () => cerrarPools());

const origen = (baseURL?: string) => new URL(baseURL ?? "http://localhost:3100").origin;

async function login(request: APIRequestContext, baseURL: string | undefined, correo: string, clave: string, ip?: string) {
  return request.post("/api/auth/sign-in/email", { data: { email: correo, password: clave }, headers: { Origin: origen(baseURL), ...(ip ? { "X-Forwarded-For": ip } : {}) } });
}

async function contextoNuevo(browser: Browser) {
  const ctx = await browser.newContext();
  return { ctx, page: await ctx.newPage() };
}

test.describe("Seguridad · configuración", () => {
  test("cabeceras de seguridad en landing, login, portal y API; CSP con nonce distinto en cada respuesta", async ({ request }) => {
    const nonces: string[] = [];
    for (const ruta of ["/es", "/login", "/p/token-inexistente-0000000000000000000000000000000"]) {
      const r = await request.get(ruta, { maxRedirects: 0 });
      const h = r.headers();
      expect(h["content-security-policy"], ruta).toMatch(/default-src 'self'.*script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'.*object-src 'none'.*frame-ancestors 'none'/);
      nonces.push(/nonce-([^']+)/.exec(h["content-security-policy"])![1]);
      expect(h["x-frame-options"]).toBe("DENY");
      expect(h["x-content-type-options"]).toBe("nosniff");
      expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
      expect(h["permissions-policy"]).toContain("camera=()");
      expect(h["x-powered-by"]).toBeUndefined();
    }
    expect(new Set(nonces).size).toBe(nonces.length);
    const api = await request.get("/api/archivos/00000000-0000-0000-0000-000000000000");
    expect(api.headers()["content-security-policy"]).toContain("default-src 'none'");
    // HSTS cuando la petición llega por HTTPS (Nginx manda X-Forwarded-Proto)
    const https = await request.get("/es", { headers: { "X-Forwarded-Proto": "https" } });
    expect(https.headers()["strict-transport-security"]).toMatch(/max-age=\d{8}/);
  });

  test("los errores no muestran stack traces ni datos internos", async ({ request }) => {
    for (const [metodo, ruta] of [
      ["GET", "/no-existe/../../etc/passwd"],
      ["GET", "/api/archivos/' OR 1=1 --"],
      ["POST", "/api/jobs/diario"],
      ["GET", "/api/tesis/propuestas/no-es-uuid/pdf"],
    ] as const) {
      const r = metodo === "GET" ? await request.get(ruta) : await request.post(ruta);
      const cuerpo = await r.text();
      expect(r.status(), ruta).toBeGreaterThanOrEqual(400);
      expect(cuerpo, ruta).not.toMatch(/at \w+ \(|node_modules|\.tsx?:\d+|Failed query|postgres|stack/i);
    }
  });
});

test.describe("Seguridad · autenticación", () => {
  test.afterAll(async () => {
    await sqlAdmin("delete from intentos_login where correo = $1", [CRED.demo.correo.toLowerCase()]);
  });

  test("fuerza bruta: 10 fallos bloquean la cuenta aunque cambie la IP, y luego ni la clave correcta entra", async ({ request, baseURL }) => {
    await sqlAdmin("delete from intentos_login where correo = $1", [CRED.demo.correo.toLowerCase()]);
    for (let i = 0; i < 10; i++) {
      const r = await login(request, baseURL, CRED.demo.correo, `incorrecta-${i}`, `198.51.100.${i + 1}`);
      expect(r.status()).toBe(401);
    }
    const r = await login(request, baseURL, CRED.demo.correo, CRED.demo.clave, "203.0.113.77");
    expect(r.status()).toBe(429);
    // Un correo inexistente se comporta igual (no revela qué cuentas existen)
    const otro = `nadie-${Date.now()}@ejemplo.com`;
    for (let i = 0; i < 10; i++) expect((await login(request, baseURL, otro, "x-incorrecta")).status()).toBe(401);
    expect((await login(request, baseURL, otro, "x-incorrecta")).status()).toBe(429);
    await sqlAdmin("delete from intentos_login where correo = $1", [otro]);
  });

  test("cookie de sesión HttpOnly + SameSite=Lax; cerrar sesión la invalida en el servidor", async ({ browser, baseURL }) => {
    await sqlAdmin("delete from intentos_login where correo = $1", [CRED.demo.correo.toLowerCase()]);
    const { ctx, page } = await contextoNuevo(browser);
    await iniciarSesion(page, "demo");
    const sesion = (await ctx.cookies()).find((c) => c.name.endsWith("session_token"))!;
    expect(sesion.httpOnly).toBe(true);
    expect(sesion.sameSite).toBe("Lax");
    // (Secure lo pone Better Auth automáticamente cuando BETTER_AUTH_URL es https; aquí es http local.)
    const r = await page.request.post("/api/auth/sign-out", { headers: { Origin: origen(baseURL) }, data: {} });
    expect(r.ok()).toBe(true);
    // Reusar la cookie robada después del logout no sirve
    const { ctx: atacante, page: p2 } = await contextoNuevo(browser);
    await atacante.addCookies([{ ...sesion }]);
    await p2.goto("/panel");
    await expect(p2).toHaveURL(/\/login/);
    await ctx.close();
    await atacante.close();
  });

  test("la sesión vencida ya no da acceso", async ({ browser }) => {
    const { ctx, page } = await contextoNuevo(browser);
    await iniciarSesion(page, "demo");
    const token = (await ctx.cookies()).find((c) => c.name.endsWith("session_token"))!.value.split(".")[0];
    await sqlAdmin("update sesiones set expira_en = now() - interval '1 minute' where token = $1", [decodeURIComponent(token)]);
    await page.goto("/panel");
    await expect(page).toHaveURL(/\/login/);
    await ctx.close();
  });

  test("recuperar contraseña responde igual exista o no el correo", async ({ request, baseURL }) => {
    const pedir = (email: string) => request.post("/api/auth/request-password-reset", { data: { email, redirectTo: "/restablecer" }, headers: { Origin: origen(baseURL) } });
    const a = await pedir(CRED.demo.correo);
    const b = await pedir(`no-existe-${Date.now()}@ejemplo.com`);
    expect(a.status()).toBe(b.status());
    expect(await a.json()).toEqual(await b.json());
  });

  test("CSRF: login y acciones desde otro sitio se rechazan", async ({ request }) => {
    const r = await request.post("/api/auth/sign-in/email", { data: { email: CRED.demo.correo, password: CRED.demo.clave }, headers: { Origin: "https://sitio-malicioso.example" } });
    expect(r.status()).toBe(403);
  });
});

test.describe("Seguridad · portal del estudiante", () => {
  test("CI incorrecto: bloqueo tras 5 intentos, también desde otro navegador y otra IP", async ({ browser }) => {
    const f = await planConPortal("dra-ponz");
    const { ctx, page } = await contextoNuevo(browser);
    await page.goto(`/p/${f.token}`);
    for (let i = 0; i < 5; i++) {
      await page.getByLabel("Carnet de identidad (CI)").fill(`000${i}`);
      await page.getByRole("button", { name: "Entrar" }).click();
      await expect(page.getByText(i < 4 ? `Te quedan ${4 - i} intento` : "Demasiados intentos fallidos")).toBeVisible();
    }
    await ctx.close();
    const otro = await browser.newContext({ extraHTTPHeaders: { "X-Forwarded-For": "203.0.113.200" }, userAgent: "OtroNavegador/1.0" });
    const p2 = await otro.newPage();
    await p2.goto(`/p/${f.token}`);
    await p2.getByLabel("Carnet de identidad (CI)").fill(f.ci); // ¡el correcto!
    await p2.getByRole("button", { name: "Entrar" }).click();
    await expect(p2.getByText("Demasiados intentos fallidos")).toBeVisible();
    await expect(p2.getByRole("button", { name: "Ya pagué, subir comprobante" })).toHaveCount(0);
    await otro.close();
  });

  test("tokens largos e impredecibles; inventados, vencidos o anulados no dan acceso (ni a archivos)", async ({ browser, baseURL }) => {
    const f = await planConPortal("dra-ponz");
    expect(f.token).toMatch(/^[A-Za-z0-9_-]{43}$/); // 256 bits
    const { ctx, page } = await contextoNuevo(browser);
    await page.goto(`/p/${f.token.slice(0, -1)}${f.token.endsWith("A") ? "B" : "A"}`);
    await expect(page.getByText("Enlace no disponible")).toBeVisible();

    await entrarPortal(page, f.token, f.ci);
    const subida = await page.request.post(`/p/${f.token}/comprobante`, { multipart: { cuotaId: f.cuotaIds[0], comprobante: { name: "c.pdf", mimeType: "application/pdf", buffer: PDF } }, headers: { Origin: origen(baseURL) } });
    expect((await subida.json()).ok).toBe(true);
    const [arch] = await sqlAdmin<{ id: string }>("select comprobante_archivo_id as id from pagos where cuota_id = $1", [f.cuotaIds[0]]);
    expect((await page.request.get(`/api/archivos/${arch.id}`)).status()).toBe(200);

    // Vence el enlace: la misma cookie ya no sirve
    await sqlAdmin("update enlaces_portal set expira_en = now() - interval '1 minute' where id = $1", [f.enlaceId]);
    await page.goto(`/p/${f.token}`);
    await expect(page.getByText("Enlace no disponible")).toBeVisible();
    expect((await page.request.get(`/api/archivos/${arch.id}`)).status()).toBe(404);
    // Anulado
    await sqlAdmin("update enlaces_portal set expira_en = null, token = null, anulado_en = now() where id = $1", [f.enlaceId]);
    await page.goto(`/p/${f.token}`);
    await expect(page.getByText("Enlace no disponible")).toBeVisible();
    await ctx.close();
  });

  test("el estudiante A no ve nada del B cambiando el token o los ids", async ({ browser, baseURL }) => {
    const a = await planConPortal("dra-ponz", "Estudiante A");
    const b = await planConPortal("dra-ponz", "Estudiante B");
    // B sube un comprobante
    const cb = await browser.newContext();
    const pb = await cb.newPage();
    await entrarPortal(pb, b.token, b.ci);
    await pb.request.post(`/p/${b.token}/comprobante`, { multipart: { cuotaId: b.cuotaIds[0], comprobante: { name: "b.pdf", mimeType: "application/pdf", buffer: PDF } }, headers: { Origin: origen(baseURL) } });
    const [archB] = await sqlAdmin<{ id: string }>("select comprobante_archivo_id as id from pagos where cuota_id = $1", [b.cuotaIds[0]]);
    await cb.close();

    const ca = await browser.newContext();
    const pa = await ca.newPage();
    await entrarPortal(pa, a.token, a.ci);
    // Token de B: pide el CI de nuevo y no muestra datos de B
    await pa.goto(`/p/${b.token}`);
    await expect(pa.getByLabel("Carnet de identidad (CI)")).toBeVisible();
    await expect(pa.getByText("Estudiante B")).toHaveCount(0);
    // Archivo de B con la sesión de A
    expect((await pa.request.get(`/api/archivos/${archB.id}`)).status()).toBe(404);
    // Cuota de B enviada al endpoint de A (cambiando el id en el body)
    const r = await pa.request.post(`/p/${a.token}/comprobante`, { multipart: { cuotaId: b.cuotaIds[1], comprobante: { name: "x.pdf", mimeType: "application/pdf", buffer: PDF } }, headers: { Origin: origen(baseURL) } });
    expect((await r.json()).ok).toBe(false);
    // Token de B en la URL de subida con la cookie de A
    const r2 = await pa.request.post(`/p/${b.token}/comprobante`, { multipart: { cuotaId: b.cuotaIds[1], comprobante: { name: "x.pdf", mimeType: "application/pdf", buffer: PDF } }, headers: { Origin: origen(baseURL) } });
    expect((await r2.json()).mensaje).toMatch(/sesión venció/);
    const [n] = await sqlAdmin<{ n: string }>("select count(*) as n from pagos where cuota_id = $1", [b.cuotaIds[1]]);
    expect(n.n).toBe("0");
    await ca.close();
  });

  test("subidas: ejecutable renombrado, SVG con script, > 50 MB, otra cuota sin pagar la 1.ª, y CSRF", async ({ browser, baseURL }) => {
    const f = await planConPortal("dra-ponz");
    const { ctx, page } = await contextoNuevo(browser);
    await entrarPortal(page, f.token, f.ci);
    const subir = (cuotaId: string, name: string, buffer: Buffer, extra: Record<string, string> = {}) =>
      page.request.post(`/p/${f.token}/comprobante`, { multipart: { cuotaId, comprobante: { name, mimeType: "application/pdf", buffer } }, headers: { Origin: origen(baseURL), ...extra } });

    let r = await subir(f.cuotaIds[0], "factura.pdf", EXE);
    expect((await r.json()).mensaje).toMatch(/no corresponde a su extensión/);
    r = await subir(f.cuotaIds[0], "logo.svg", SVG);
    expect((await r.json()).mensaje).toMatch(/no permitido/);
    r = await subir(f.cuotaIds[0], "../../../etc/cron.d/x.html", Buffer.from("<script>alert(1)</script>"));
    expect((await r.json()).ok).toBe(false);
    r = await subir(f.cuotaIds[1], "c.pdf", PDF);
    expect((await r.json()).mensaje).toMatch(/Primero paga la cuota 1/);
    r = await page.request.post(`/p/${f.token}/comprobante`, { multipart: { cuotaId: f.cuotaIds[0], comprobante: { name: "g.pdf", mimeType: "application/pdf", buffer: Buffer.concat([PDF, Buffer.alloc(51 * 1024 * 1024)]) } }, headers: { Origin: origen(baseURL) } });
    expect((await r.json()).mensaje).toMatch(/50 MB/);
    // CSRF: otro sitio
    r = await subir(f.cuotaIds[0], "c.pdf", PDF, { Origin: "https://sitio-malicioso.example" });
    expect(r.status()).toBe(403);
    const [n] = await sqlAdmin<{ n: string }>("select count(*) as n from pagos where plan_id = $1", [f.planId]);
    expect(n.n).toBe("0");
    // Ahora sí, el comprobante válido; queda pendiente (el portal no puede aprobar)
    r = await subir(f.cuotaIds[0], "c.pdf", PDF);
    expect((await r.json()).ok).toBe(true);
    const [p] = await sqlAdmin<{ estado: string; monto_centavos: number }>("select estado, monto_centavos from pagos where cuota_id = $1", [f.cuotaIds[0]]);
    expect(p).toEqual({ estado: "pendiente", monto_centavos: 10000 });
    await ctx.close();
  });

  test("antes de validar el CI no aparecen datos del cliente ni WhatsApp", async ({ page }) => {
    const f = await planConPortal("dra-ponz", "Cliente Muy Privado");
    await page.goto(`/p/${f.token}`);
    const html = await page.content();
    for (const x of ["Cliente Muy Privado", "59170001234", "Nota privada", f.ci, "wa.me"]) expect(html, x).not.toContain(x);
  });
});

test.describe("Seguridad · archivos, permisos, inyecciones y dinero (panel)", () => {
  test("descargas: solo con autorización, como adjunto, tipo correcto, nosniff y sandbox", async ({ browser, baseURL }) => {
    const f = await planConPortal("dra-ponz");
    const cp = await browser.newContext();
    const pp = await cp.newPage();
    await entrarPortal(pp, f.token, f.ci);
    await pp.request.post(`/p/${f.token}/comprobante`, { multipart: { cuotaId: f.cuotaIds[0], comprobante: { name: '"; evil=1.pdf', mimeType: "application/pdf", buffer: PDF } }, headers: { Origin: origen(baseURL) } });
    const [a] = await sqlAdmin<{ id: string }>("select comprobante_archivo_id as id from pagos where cuota_id = $1", [f.cuotaIds[0]]);
    await cp.close();

    const anonimo = await browser.newContext();
    expect((await anonimo.request.get(`/api/archivos/${a.id}`)).status()).toBe(404);
    await anonimo.close();

    const { ctx: cd, page: dra } = await contextoNuevo(browser);
    await iniciarSesion(dra, "dra");
    const r = await dra.request.get(`/api/archivos/${a.id}`);
    expect(r.status()).toBe(200);
    const h = r.headers();
    expect(h["content-type"]).toBe("application/pdf");
    expect(h["content-disposition"]).toMatch(/^attachment; filename\*=UTF-8''/);
    expect(h["content-disposition"]).not.toContain('"; evil');
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["content-security-policy"]).toContain("sandbox");
    expect(h["cache-control"]).toContain("no-store");
    await cd.close();

    // Otra organización (Demo) no lo descarga
    const { ctx: cm, page: demo } = await contextoNuevo(browser);
    await sqlAdmin("delete from intentos_login where correo = $1", [CRED.demo.correo.toLowerCase()]);
    await iniciarSesion(demo, "demo");
    expect((await demo.request.get(`/api/archivos/${a.id}`)).status()).toBe(404);
    await cm.close();
  });

  test("IDOR en el panel: Demo no abre clientes, planes ni proyectos de la Dra. cambiando el id en la URL", async ({ page }) => {
    const f = await planConPortal("dra-ponz", "Cliente de la Dra");
    const [prop] = await sqlAdmin<{ id: string }>("select p.id from propuestas p join organizaciones o on o.id = p.organizacion_id where o.slug = 'dra-ponz' limit 1");
    await sqlAdmin("delete from intentos_login where correo = $1", [CRED.demo.correo.toLowerCase()]);
    await iniciarSesion(page, "demo");
    for (const ruta of [`/panel/cobros/clientes/${f.clienteId}`, `/panel/cobros/planes/${f.planId}`]) {
      await page.goto(ruta);
      await expect(page.getByText("Cliente de la Dra")).toHaveCount(0);
      await expect(page.getByText(/no encontrad|no existe|404/i).first()).toBeVisible();
    }
    // Sin módulo Tesis: ni páginas ni API
    if (prop) {
      expect((await page.request.get(`/api/tesis/propuestas/${prop.id}/pdf`)).status()).toBe(403);
      await page.goto(`/panel/tesis/propuestas/${prop.id}`);
      await expect(page.getByText(/Acceso no permitido|no encontrada/)).toBeVisible();
    }
    await page.goto("/panel/tesis/calendario");
    await expect(page.getByText(/Acceso no permitido|no encontrada/)).toBeVisible();
    // Solo el superadmin entra a /superadmin
    await page.goto("/superadmin");
    await expect(page.getByText(/Acceso no permitido|no encontrada/)).toBeVisible();
    await expect(page.getByTestId("org-dra-ponz")).toHaveCount(0);
  });

  test("sin sesión: nada del panel, recordatorios ni WhatsApp", async ({ page, request }) => {
    for (const ruta of ["/panel", "/panel/cobros/recordatorios", "/panel/cobros/clientes", "/superadmin"]) {
      await page.goto(ruta);
      await expect(page, ruta).toHaveURL(/\/login/);
      expect(await page.content()).not.toContain("wa.me");
    }
    expect((await request.post("/api/jobs/diario")).status()).toBe(401);
    expect((await request.post("/api/jobs/diario", { headers: { Authorization: "Bearer adivinanza" } })).status()).toBe(401);
  });

  test("XSS: nombres, notas, textos de la landing y mensajes de WhatsApp se muestran como texto", async ({ page, browser }) => {
    const carga = `<img src=x onerror="window.__xss=1">"><script>window.__xss=2</script>`;
    const f = await planConPortal("dra-ponz", `XSS ${carga}`);
    await sqlAdmin("update clientes set notas = $1 where id = $2", [carga, f.clienteId]);
    await sqlAdmin("update cuotas set fecha_vencimiento = current_date - 3 where id = $1", [f.cuotaIds[0]]);
    // Texto de la landing con la carga, guardado desde el editor del panel (como lo haría alguien con cuenta)
    const editarLanding = async (valor: string) => {
      await page.goto("/panel/tesis/landing?idioma=es");
      await page.locator('[id="problemas.cierre"]').fill(valor);
      await page.getByRole("button", { name: "Guardar textos (ES)" }).click();
      await expect(page.getByText("Textos guardados.")).toBeVisible();
    };
    await iniciarSesion(page, "dra");
    await page.goto("/panel/tesis/landing?idioma=es");
    const antes = await page.locator('[id="problemas.cierre"]').inputValue();
    await editarLanding(carga);
    try {
      const dialogos: string[] = [];
      page.on("dialog", (d) => {
        dialogos.push(d.message());
        void d.dismiss();
      });
      for (const ruta of [`/panel/cobros/clientes/${f.clienteId}`, "/panel/cobros/clientes", "/panel/cobros/recordatorios", `/panel/buscar?q=${encodeURIComponent("XSS")}`]) {
        await page.goto(ruta);
        await page.waitForLoadState("networkidle");
        expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss), ruta).toBeUndefined();
      }
      await page.goto(`/panel/cobros/clientes/${f.clienteId}`);
      await expect(page.getByText(carga).first()).toBeVisible(); // texto literal
      // Mensaje de WhatsApp: el texto va codificado en la URL
      await page.goto("/panel/cobros/recordatorios");
      for (const href of await page.locator('a[href*="wa.me"]').evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""))) expect(href).not.toMatch(/[<>"]/);
      const visitante = await browser.newPage();
      visitante.on("dialog", (d) => {
        dialogos.push(d.message());
        void d.dismiss();
      });
      await visitante.goto("/es");
      await expect(visitante.getByText(carga)).toBeVisible();
      expect(await visitante.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
      await visitante.close();
      expect(dialogos).toEqual([]);
    } finally {
      await editarLanding(antes);
    }
  });

  test("inyección SQL en búsquedas y filtros del panel: sin errores ni datos de más", async ({ page }) => {
    await iniciarSesion(page, "dra");
    for (const q of ["' OR '1'='1", "'; DROP TABLE clientes; --", "%' UNION SELECT correo, null FROM usuarios --", "\\'", "%%"]) {
      for (const ruta of [`/panel/buscar?q=${encodeURIComponent(q)}`, `/panel/cobros/clientes?q=${encodeURIComponent(q)}`, `/panel/tesis/propuestas?q=${encodeURIComponent(q)}`]) {
        const r = await page.goto(ruta);
        expect(r?.status(), ruta).toBeLessThan(500);
        expect(await page.content(), ruta).not.toMatch(/superadmin@|Failed query|syntax error/i);
      }
    }
    const [n] = await sqlAdmin<{ n: string }>("select count(*) as n from clientes");
    expect(Number(n.n)).toBeGreaterThan(0);
  });

  test("dinero: una acción de aprobar repetida sin sesión del panel (desde el portal) no aprueba nada", async ({ browser, baseURL }) => {
    const f = await planConPortal("dra-ponz", `Pago ${Date.now()}`);
    const cp = await browser.newContext();
    const pp = await cp.newPage();
    await entrarPortal(pp, f.token, f.ci);
    await pp.request.post(`/p/${f.token}/comprobante`, { multipart: { cuotaId: f.cuotaIds[0], comprobante: { name: "c.pdf", mimeType: "application/pdf", buffer: PDF } }, headers: { Origin: origen(baseURL) } });

    // La Dra. pulsa "Aprobar": capturamos la petición de la server action SIN dejar que llegue al servidor.
    const { ctx: cd, page: dra } = await contextoNuevo(browser);
    await iniciarSesion(dra, "dra");
    let capturada: { url: string; headers: Record<string, string>; body: string } | null = null;
    await dra.route("**/*", async (route) => {
      const req = route.request();
      if (req.method() === "POST" && req.headers()["next-action"]) {
        capturada = { url: req.url(), headers: req.headers(), body: req.postData() ?? "" };
        return route.abort();
      }
      return route.continue();
    });
    await dra.goto("/panel/cobros/pagos");
    const tarjeta = dra.getByTestId("comprobante-pendiente").filter({ hasText: f.nombre });
    await expect(tarjeta).toBeVisible();
    await tarjeta.getByRole("button", { name: "Aprobar" }).click();
    await expect.poll(() => capturada).not.toBeNull();
    await cd.close();

    // Repetida desde el contexto del portal (solo cookie de portal) y desde otro sitio
    const c = capturada!;
    const cabeceras = { "next-action": c.headers["next-action"], "content-type": c.headers["content-type"], accept: "text/x-component" };
    const r1 = await pp.request.post(c.url, { headers: { ...cabeceras, origin: origen(baseURL) }, data: c.body });
    const r2 = await pp.request.post(c.url, { headers: { ...cabeceras, origin: "https://sitio-malicioso.example" }, data: c.body });
    expect(await r1.text()).not.toContain("Pago aprobado");
    expect(r2.status()).toBeGreaterThanOrEqual(400); // Next rechaza server actions de otro origen
    const [p] = await sqlAdmin<{ estado: string }>("select estado from pagos where cuota_id = $1", [f.cuotaIds[0]]);
    expect(p.estado).toBe("pendiente");
    const [q] = await sqlAdmin<{ estado: string }>("select estado from cuotas where id = $1", [f.cuotaIds[0]]);
    expect(q.estado).toBe("pendiente");
    await cp.close();
  });
});
