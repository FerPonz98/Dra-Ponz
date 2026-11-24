// Auditoría de seguridad a nivel de BD y servicios: RLS en TODAS las tablas, IDOR, dinero, archivos,
// inyección SQL, errores internos, límites e IP. Corre contra la base de .env (o la de DOTENV_CONFIG_PATH).
import { eq, sql } from "drizzle-orm";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { directorioSubidas, guardarArchivo, LIMITE_BYTES, validarArchivo } from "@/core/archivos";
import { estaBloqueadaCuenta, MAX_FALLIDOS_LOGIN, registrarIntentoLogin } from "@/core/auth/bloqueo";
import { archivos, intentosLogin, organizaciones } from "@/core/db/schema";
import { mensajeDeError } from "@/lib/acciones";
import { dbAdmin, dbApp, withAdmin, withOrg } from "@/lib/db";
import { ipCliente, permitir } from "@/lib/seguridad";
import { generarCuotas } from "@/modules/cobros/dominio/plan";
import { cuotas, enlacesPortal, pagos } from "@/modules/cobros/schema";
import { crearCliente, listarClientes, obtenerCliente } from "@/modules/cobros/servicios/clientes";
import { anularEnlace, crearEnlace } from "@/modules/cobros/servicios/enlaces";
import { aprobarPago, registrarPago } from "@/modules/cobros/servicios/pagos";
import { crearPlan, esquemaPlan, guardarCuotas, obtenerPlanCompleto } from "@/modules/cobros/servicios/planes";
import { crearOrgsDePrueba } from "./ayudas";

const PDF = new Uint8Array(readFileSync("tests/fixtures/comprobante.pdf"));
const archivo = (nombre: string, bytes: Uint8Array | string, tipo = "application/octet-stream") => new File([typeof bytes === "string" ? new TextEncoder().encode(bytes) : new Uint8Array(bytes)], nombre, { type: tipo });
const HOY = "2026-03-01";
/** Mensaje del error con su causa (Drizzle envuelve el error de Postgres en "Failed query … cause"). */
const textoError = async (p: Promise<unknown>) => {
  try {
    await p;
    return "SIN ERROR";
  } catch (e) {
    return `${(e as Error).message} | ${((e as Error).cause as Error | undefined)?.message ?? ""}`;
  }
};

describe("Seguridad · aislamiento y lógica de negocio (BD)", () => {
  let A: string;
  let B: string;
  let borrar: () => Promise<unknown>;
  const datosB = {} as { clienteId: string; planId: string; cuotaIds: string[]; enlaceId: string; pagoId: string; archivoId: string };
  let planA: { id: string; cuotaIds: string[] };

  beforeAll(async () => {
    const r = await crearOrgsDePrueba(2);
    [A, B] = r.orgs.map((o) => o.id);
    borrar = r.borrar;
    // B: cliente, plan con 3 cuotas, enlace, comprobante (pago pendiente + archivo)
    await withOrg(B, async (tx) => {
      const actor = { organizacionId: B, usuarioId: null, usuarioNombre: "B" };
      const c = await crearCliente(tx, B, { nombre: "Secreto de B", ci: "1111111", whatsapp: "59170000001" });
      const p = await crearPlan(tx, actor, { clienteId: c.id, titulo: "Plan B", moneda: "BOB", cuotas: generarCuotas(3, 30000, HOY) });
      const cs = await tx.select().from(cuotas).where(eq(cuotas.planId, p.id)).orderBy(cuotas.numero);
      const e = await crearEnlace(tx, { organizacionId: B, planId: p.id, metodo: "ci" });
      const pago = await registrarPago(tx, { organizacionId: B, planId: p.id, cuotaId: cs[0].id, enlaceId: e.enlace.id, archivo: archivo("c.pdf", PDF), hoy: HOY });
      Object.assign(datosB, { clienteId: c.id, planId: p.id, cuotaIds: cs.map((x) => x.id), enlaceId: e.enlace.id, pagoId: pago.id, archivoId: pago.comprobanteArchivoId });
    });
    await withOrg(A, async (tx) => {
      const actor = { organizacionId: A, usuarioId: null, usuarioNombre: "A" };
      const c = await crearCliente(tx, A, { nombre: "Cliente de A" });
      const p = await crearPlan(tx, actor, { clienteId: c.id, titulo: "Plan A", moneda: "BOB", cuotas: generarCuotas(3, 30000, HOY) });
      const cs = await tx.select().from(cuotas).where(eq(cuotas.planId, p.id)).orderBy(cuotas.numero);
      planA = { id: p.id, cuotaIds: cs.map((x) => x.id) };
    });
  });
  afterAll(async () => borrar());

  // ───────────── RLS en TODAS las tablas con organizacion_id ─────────────
  it("todas las tablas con organizacion_id tienen RLS activado y política con USING y WITH CHECK", async () => {
    const r = await dbAdmin().execute<{ tabla: string; rls: boolean; usando: string | null; chequeo: string | null }>(sql`
      select c.table_name as tabla, cl.relrowsecurity as rls, p.qual as usando, p.with_check as chequeo
      from information_schema.columns c
      join pg_class cl on cl.relname = c.table_name and cl.relkind = 'r'
      left join pg_policies p on p.tablename = c.table_name and p.policyname = 'aislamiento_organizacion'
      where c.table_schema = 'public' and c.column_name = 'organizacion_id' and c.table_name not in ('usuarios')`);
    expect(r.rows.length).toBeGreaterThanOrEqual(20);
    const malas = r.rows.filter((x) => !x.rls || !x.usando?.includes("app.organizacion_id") || !x.chequeo?.includes("app.organizacion_id"));
    expect(malas.map((x) => x.tabla)).toEqual([]);
  });

  it("A no puede LEER, EDITAR ni BORRAR filas de otra organización en ninguna tabla", async () => {
    const tablas = (
      await dbAdmin().execute<{ t: string }>(sql`select table_name as t from information_schema.columns c join pg_class cl on cl.relname=c.table_name and cl.relkind='r' where table_schema='public' and column_name='organizacion_id' and table_name <> 'usuarios' order by 1`)
    ).rows.map((x) => x.t);
    const cubiertas: string[] = [];
    for (const t of tablas) {
      const ajenas = Number((await dbAdmin().execute<{ n: string }>(sql`select count(*) as n from ${sql.identifier(t)} where organizacion_id <> ${A}`)).rows[0].n);
      if (ajenas > 0) cubiertas.push(t);
      // Todo dentro de una transacción que se revierte siempre: si RLS fallara, no se pierde nada.
      const r = await withOrg(A, async (tx) => {
        const ver = Number((await tx.execute<{ n: string }>(sql`select count(*) as n from ${sql.identifier(t)} where organizacion_id <> ${A}`)).rows[0].n);
        const editar = (await tx.execute(sql`update ${sql.identifier(t)} set organizacion_id = organizacion_id where organizacion_id <> ${A}`)).rowCount;
        const borrar = (await tx.execute(sql`delete from ${sql.identifier(t)} where organizacion_id <> ${A}`)).rowCount;
        throw Object.assign(new Error("rollback"), { resultado: { ver, editar, borrar } });
      }).catch((e) => (e as { resultado?: unknown }).resultado ?? Promise.reject(e));
      expect(r, t).toEqual({ ver: 0, editar: 0, borrar: 0 });
    }
    // Con los datos de B creados arriba, las tablas de Cobros quedan cubiertas sí o sí.
    for (const t of ["clientes", "planes_pago", "cuotas", "enlaces_portal", "pagos", "archivos"]) expect(cubiertas, t).toContain(t);
  });

  it("A no puede CREAR filas a nombre de B en ninguna tabla (copia una fila real de B con otro id)", async () => {
    const tablas = (await dbAdmin().execute<{ t: string }>(sql`select distinct table_name as t from information_schema.columns where table_schema='public' and column_name='organizacion_id' and table_name <> 'usuarios'`)).rows.map((x) => x.t);
    let probadas = 0;
    for (const t of tablas) {
      const fila = (await dbAdmin().execute<{ j: Record<string, unknown> }>(sql`select row_to_json(x) as j from ${sql.identifier(t)} x where organizacion_id = ${B} limit 1`)).rows[0]?.j;
      if (!fila) continue;
      if ("id" in fila && typeof fila.id === "string" && /^[0-9a-f-]{36}$/.test(fila.id)) fila.id = crypto.randomUUID();
      if ("token" in fila && fila.token) fila.token = `x${crypto.randomUUID()}`;
      probadas++;
      await expect(
        withOrg(A, (tx) => tx.execute(sql`insert into ${sql.identifier(t)} select * from json_populate_record(null::${sql.identifier(t)}, ${JSON.stringify(fila)}::json)`)),
        t,
      ).rejects.toThrow();
    }
    expect(probadas).toBeGreaterThanOrEqual(7);
  });

  it("A no puede colgar filas suyas de registros de B (FK compuestas con organizacion_id)", async () => {
    // Las FK de Postgres se comprueban sin RLS: sin la FK compuesta, A podía crear una cuota suya en el plan de B.
    const intento = withOrg(A, (tx) => tx.insert(cuotas).values({ organizacionId: A, planId: datosB.planId, numero: 9, montoCentavos: 100, fechaVencimiento: HOY }));
    expect(await textoError(intento)).toMatch(/cuotas_plan_id_misma_org/);
    const n = Number((await dbAdmin().execute<{ n: string }>(sql`select count(*) as n from pg_constraint where conname like '%_misma_org'`)).rows[0].n);
    expect(n).toBeGreaterThanOrEqual(25);
  });

  it("la tabla organizaciones: A solo se ve a sí misma y no puede editar a B", async () => {
    const r = await withOrg(A, async (tx) => ({
      visibles: (await tx.select({ id: organizaciones.id }).from(organizaciones)).map((x) => x.id),
      editadas: (await tx.update(organizaciones).set({ nombre: "hackeada" }).where(eq(organizaciones.id, B)).returning()).length,
    }));
    expect(r).toEqual({ visibles: [A], editadas: 0 });
  });

  it("el rol de la app no puede tocar las tablas de autenticación ni sus límites", async () => {
    for (const t of ["usuarios", "sesiones", "cuentas", "verificaciones", "limites_auth", "intentos_login"]) {
      expect(await textoError(dbApp().execute(sql`select 1 from ${sql.identifier(t)} limit 1`)), t).toMatch(/permission denied/);
    }
  });

  // ───────────── IDOR: ids de B usados desde A ─────────────
  it("IDOR: con ids de B, los servicios de A no encuentran ni modifican nada", async () => {
    await withOrg(A, async (tx) => {
      expect(await obtenerCliente(tx, datosB.clienteId)).toBeNull();
      expect(await obtenerPlanCompleto(tx, datosB.planId)).toBeNull();
      await expect(aprobarPago(tx, { organizacionId: A, usuarioId: null, usuarioNombre: "A" }, datosB.pagoId, HOY)).rejects.toThrow("Pago no encontrado");
      await anularEnlace(tx, datosB.enlaceId);
      // Antes de la corrección esto CREABA cuotas de A colgadas del plan de B (las FK no miran RLS).
      expect(await textoError(tx.transaction((sp) => guardarCuotas(sp, { organizacionId: A, usuarioId: null, usuarioNombre: "A" }, datosB.planId, [{ numero: 1, montoCentavos: 100, fechaVencimiento: HOY }] as never)))).toMatch(/misma_org|no encontrado/i);
      expect(await tx.select().from(archivos).where(eq(archivos.id, datosB.archivoId))).toEqual([]);
      // Cuota de B usada en el plan de A
      await expect(registrarPago(tx, { organizacionId: A, planId: planA.id, cuotaId: datosB.cuotaIds[1], enlaceId: null, archivo: archivo("c.pdf", PDF), hoy: HOY })).rejects.toThrow("Cuota no encontrada");
    });
    const [e] = await dbAdmin().select().from(enlacesPortal).where(eq(enlacesPortal.id, datosB.enlaceId));
    expect(e.token).not.toBeNull(); // el enlace de B sigue vivo
    const [p] = await dbAdmin().select().from(pagos).where(eq(pagos.id, datosB.pagoId));
    expect(p.estado).toBe("pendiente");
  });

  // ───────────── Dinero ─────────────
  it("no se puede saltar la 1.ª cuota: el comprobante de la 2.ª se rechaza", async () => {
    await expect(withOrg(A, (tx) => registrarPago(tx, { organizacionId: A, planId: planA.id, cuotaId: planA.cuotaIds[1], enlaceId: null, archivo: archivo("c.pdf", PDF), hoy: HOY }))).rejects.toThrow("Primero paga la cuota 1");
  });

  it("el monto del pago sale de la cuota (el cliente no lo manda) y dos subidas a la vez dejan un solo pago pendiente", async () => {
    const intentos = await Promise.allSettled(
      [1, 2, 3].map(() => withOrg(A, (tx) => registrarPago(tx, { organizacionId: A, planId: planA.id, cuotaId: planA.cuotaIds[0], enlaceId: null, archivo: archivo("c.pdf", PDF), hoy: HOY }))),
    );
    const ok = intentos.filter((x) => x.status === "fulfilled");
    expect(ok).toHaveLength(1);
    const pagosCuota = await dbAdmin().select().from(pagos).where(eq(pagos.cuotaId, planA.cuotaIds[0]));
    expect(pagosCuota).toHaveLength(1);
    expect(pagosCuota[0].montoCentavos).toBe(10000);
    expect(pagosCuota[0].estado).toBe("pendiente");
    // con la 1.ª en revisión, ya se puede mandar la 2.ª
    await withOrg(A, (tx) => registrarPago(tx, { organizacionId: A, planId: planA.id, cuotaId: planA.cuotaIds[1], enlaceId: null, archivo: archivo("c.pdf", PDF), hoy: HOY }));
  });

  it("no se aceptan montos negativos ni cero (Zod y CHECK en la BD)", async () => {
    expect(esquemaPlan.safeParse({ clienteId: crypto.randomUUID(), titulo: "x", moneda: "BOB", cuotas: [{ numero: 1, montoCentavos: -500, fechaVencimiento: HOY }] }).success).toBe(false);
    expect(await textoError(withAdmin((tx) => tx.update(cuotas).set({ montoCentavos: -1 }).where(eq(cuotas.id, planA.cuotaIds[2]))))).toMatch(/cuotas_monto_positivo/);
    expect(await textoError(withAdmin((tx) => tx.update(pagos).set({ montoCentavos: 0 }).where(eq(pagos.id, datosB.pagoId))))).toMatch(/pagos_monto_positivo/);
  });

  // ───────────── Inyección SQL ─────────────
  it("inyección SQL en búsquedas: se trata como texto (sin errores ni filas de más)", async () => {
    for (const q of ["' OR 1=1 --", "'; drop table clientes; --", "%' union select * from usuarios --", "\\", "%_%"]) {
      const r = await withOrg(A, (tx) => listarClientes(tx, q));
      expect(r.every((c) => c.organizacionId === A), q).toBe(true);
      expect(r.length, q).toBeLessThanOrEqual(1);
    }
    const n = Number((await dbAdmin().execute<{ n: string }>(sql`select count(*) as n from clientes`)).rows[0].n);
    expect(n).toBeGreaterThan(0);
  });

  // ───────────── Archivos ─────────────
  it("archivos: ejecutable renombrado, SVG/HTML con script, vacío y > 50 MB se rechazan", () => {
    const mz = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0, 0, 0, 0x04, 0, 0, 0, 0xff, 0xff, 0, 0]);
    expect(validarArchivo("factura.pdf", 1000, mz, ["pdf", "imagen"]).ok).toBe(false);
    expect(validarArchivo("foto.png", 1000, mz, ["pdf", "imagen"]).ok).toBe(false);
    const svg = new TextEncoder().encode('<svg onload="alert(1)">');
    expect(validarArchivo("logo.svg", 30, svg, ["imagen", "pdf", "zip", "word", "excel"]).ok).toBe(false);
    expect(validarArchivo("x.html", 30, new TextEncoder().encode("<script>alert(1)</script>"), ["imagen", "pdf", "zip", "word", "excel"]).ok).toBe(false);
    expect(validarArchivo("x.pdf.html", 30, PDF.subarray(0, 16), ["pdf"]).ok).toBe(false);
    expect(validarArchivo("vacio.pdf", 0, PDF.subarray(0, 16), ["pdf"]).ok).toBe(false);
    expect(validarArchivo("grande.pdf", LIMITE_BYTES + 1, PDF.subarray(0, 16), ["pdf"]).ok).toBe(false);
  });

  it("archivos: un archivo de 51 MB no se guarda; un nombre con ../ no sale de UPLOAD_DIR", async () => {
    const grande = new Uint8Array(51 * 1024 * 1024);
    grande.set(PDF.subarray(0, 16));
    await expect(withOrg(A, (tx) => guardarArchivo(tx, { organizacionId: A, categoria: "pruebas", archivo: archivo("grande.pdf", grande), permitidos: ["pdf"] }))).rejects.toThrow(/50 MB/);
    const f = await withOrg(A, (tx) => guardarArchivo(tx, { organizacionId: A, categoria: "pruebas", archivo: archivo("../../../../etc/passwd.pdf", PDF), permitidos: ["pdf"] }));
    expect(f.rutaRelativa).toMatch(new RegExp(`^${A}/pruebas/[0-9a-f-]{36}\\.pdf$`));
    expect(f.nombreOriginal).toBe("../../../../etc/passwd.pdf"); // solo se guarda como texto (se escapa al descargar)
    await expect(withOrg(A, (tx) => guardarArchivo(tx, { organizacionId: A, categoria: "../../x", archivo: archivo("a.pdf", PDF), permitidos: ["pdf"] }))).rejects.toThrow();
  });

  it("archivos: un ZIP bomba se guarda tal cual y nunca se descomprime en el servidor", async () => {
    const zip = new Uint8Array(readFileSync("tests/fixtures/datos.zip"));
    const f = await withOrg(A, (tx) => guardarArchivo(tx, { organizacionId: A, categoria: "pruebas", archivo: archivo("bomba.zip", zip), permitidos: ["zip"] }));
    expect(f.tamanoBytes).toBe(zip.byteLength);
    // Ninguna dependencia ni código descomprime ZIP: no hay forma de que "explote".
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { dependencies: Record<string, string> };
    expect(Object.keys(pkg.dependencies).filter((d) => /zip|unzip|yauzl|tar|decompress|archiver/i.test(d))).toEqual([]);
  });

  it("UPLOAD_DIR que caería dentro de .next (se borra en cada deploy) se rechaza", () => {
    const antes = process.env.UPLOAD_DIR;
    try {
      process.env.UPLOAD_DIR = "./.next/standalone/.data/uploads";
      expect(() => directorioSubidas()).toThrow(/dentro de \.next/);
      process.env.UPLOAD_DIR = "./.data/uploads";
      expect(directorioSubidas()).toMatch(/[\\/]\.data[\\/]uploads$/);
    } finally {
      process.env.UPLOAD_DIR = antes;
    }
  });

  // ───────────── Errores internos ─────────────
  it("los errores de la BD no llegan al usuario (sin SQL, tablas ni valores)", async () => {
    const e = await withOrg(A, (tx) => tx.execute(sql`select * from tabla_que_no_existe`)).catch((x) => x);
    const m = mensajeDeError(e);
    expect(m).toBe("Ocurrió un error inesperado. Inténtalo de nuevo.");
    expect(mensajeDeError(new Error("Primero paga la cuota 1."))).toBe("Primero paga la cuota 1.");
  });
});

describe("Seguridad · login por cuenta, límites e IP", () => {
  const correo = `fuerza-bruta-${crypto.randomUUID()}@ejemplo.com`;
  afterAll(async () => {
    await dbAdmin().delete(intentosLogin).where(eq(intentosLogin.correo, correo));
  });

  it(`${MAX_FALLIDOS_LOGIN} fallos con el mismo correo bloquean la cuenta (desde cualquier IP) y es atómico`, async () => {
    await Promise.all(Array.from({ length: MAX_FALLIDOS_LOGIN - 1 }, () => registrarIntentoLogin(correo, false)));
    expect(await estaBloqueadaCuenta(correo)).toBe(false);
    await registrarIntentoLogin(correo.toUpperCase(), false); // el correo se normaliza
    expect(await estaBloqueadaCuenta(correo)).toBe(true);
    expect(await estaBloqueadaCuenta(correo, new Date(Date.now() + 16 * 60_000))).toBe(false);
  });

  it("límite por IP con ventana fija", () => {
    const t = 1_000_000;
    const clave = `prueba:${crypto.randomUUID()}`;
    for (let i = 0; i < 5; i++) expect(permitir(clave, 5, 60_000, t)).toBe(true);
    expect(permitir(clave, 5, 60_000, t + 1)).toBe(false);
    expect(permitir(clave, 5, 60_000, t + 60_001)).toBe(true);
  });

  it("la IP del cliente no se puede falsificar con X-Forwarded-For detrás de Nginx", () => {
    // Nginx agrega la IP real al final: "lo-que-mandó-el-cliente, ip-real"
    expect(ipCliente(new Headers({ "x-forwarded-for": "1.2.3.4, 203.0.113.9" }))).toBe("203.0.113.9");
    expect(ipCliente(new Headers({ "x-forwarded-for": "203.0.113.9, 127.0.0.1" }))).toBe("203.0.113.9");
    expect(ipCliente(new Headers({ "x-real-ip": "198.51.100.7" }))).toBe("198.51.100.7");
  });
});
