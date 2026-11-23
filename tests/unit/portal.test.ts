import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withOrg } from "@/lib/db";
import { generarCuotas } from "@/modules/cobros/dominio/plan";
import { aplicarIntento, firmarSesionPortal, generarToken, MAX_INTENTOS, verificarSesionPortal } from "@/modules/cobros/dominio/portal";
import { enlacesPortal } from "@/modules/cobros/schema";
import { crearCliente } from "@/modules/cobros/servicios/clientes";
import { anularEnlace, crearEnlace, intentarAcceso, resolverToken } from "@/modules/cobros/servicios/enlaces";
import { crearPlan } from "@/modules/cobros/servicios/planes";
import { crearOrgsDePrueba } from "./ayudas";

describe("Portal: token y bloqueo (puro)", () => {
  it("los tokens son largos, aleatorios y url-safe", () => {
    const t = new Set(Array.from({ length: 200 }, generarToken));
    expect(t.size).toBe(200);
    for (const x of t) expect(x).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("5 intentos fallidos bloquean 15 minutos; un acierto reinicia", () => {
    const t0 = new Date("2026-03-01T10:00:00Z");
    let e = { intentosFallidos: 0, bloqueadoHasta: null as Date | null };
    for (let i = 1; i < MAX_INTENTOS; i++) {
      e = aplicarIntento(e, false, t0);
      expect(e).toEqual({ intentosFallidos: i, bloqueadoHasta: null });
    }
    e = aplicarIntento(e, false, t0);
    expect(e.bloqueadoHasta?.toISOString()).toBe("2026-03-01T10:15:00.000Z");
    expect(aplicarIntento({ intentosFallidos: 3, bloqueadoHasta: null }, true, t0)).toEqual({ intentosFallidos: 0, bloqueadoHasta: null });
  });

  it("la cookie de sesión del portal está firmada y vence", () => {
    const id = "6f1d2c1e-6b8a-4c55-9d0e-111111111111";
    const ahora = new Date("2026-03-01T10:00:00Z");
    const v = firmarSesionPortal(id, ahora);
    expect(verificarSesionPortal(v, id, ahora)).toBe(true);
    expect(verificarSesionPortal(v.replace(/.$/, "x"), id, ahora)).toBe(false);
    expect(verificarSesionPortal(v, "otro-id", ahora)).toBe(false);
    expect(verificarSesionPortal(v, id, new Date("2026-03-01T13:00:00Z"))).toBe(false);
  });
});

describe("Portal: CI/PIN incorrecto bloquea tras 5 intentos (BD)", () => {
  let org: string;
  let borrar: () => Promise<unknown>;
  let token: string;
  let pinToken: string;
  let pin: string;
  beforeAll(async () => {
    const r = await crearOrgsDePrueba(1);
    org = r.orgs[0].id;
    borrar = r.borrar;
    await withOrg(org, async (tx) => {
      const actor = { organizacionId: org, usuarioId: null, usuarioNombre: "test" };
      const c = await crearCliente(tx, org, { nombre: "Luis", ci: "7654321 LP" });
      const p = await crearPlan(tx, actor, { clienteId: c.id, titulo: "Curso", moneda: "BOB", cuotas: generarCuotas(2, 20000, "2026-03-01") });
      token = (await crearEnlace(tx, { organizacionId: org, planId: p.id, metodo: "ci" })).token;
      const c2 = await crearCliente(tx, org, { nombre: "Eva" });
      const p2 = await crearPlan(tx, actor, { clienteId: c2.id, titulo: "Curso 2", moneda: "BOB", cuotas: generarCuotas(1, 10000, "2026-03-01") });
      const e2 = await crearEnlace(tx, { organizacionId: org, planId: p2.id, metodo: "pin" });
      pinToken = e2.token;
      pin = e2.pin!;
    });
  });
  afterAll(async () => borrar());

  it("acepta el CI normalizado (espacios, mayúsculas)", async () => {
    const r = await resolverToken(token);
    expect(r).not.toBeNull();
    expect(await intentarAcceso(r!, "7654321lp")).toEqual({ ok: true });
  });

  it("acepta el PIN correcto y rechaza otro", async () => {
    const r = (await resolverToken(pinToken))!;
    expect(pin).toMatch(/^\d{6}$/);
    expect((await intentarAcceso(r, pin === "000000" ? "111111" : "000000")).ok).toBe(false);
    expect(await intentarAcceso(r, pin)).toEqual({ ok: true });
  });

  it("tras 5 intentos fallidos queda bloqueado aunque luego ponga el CI correcto", async () => {
    const r = (await resolverToken(token))!;
    const ahora = new Date();
    for (let i = 0; i < 4; i++) {
      const x = await intentarAcceso(r, "0000000", ahora);
      expect(x).toMatchObject({ ok: false, bloqueado: false, restantes: 4 - i });
    }
    expect(await intentarAcceso(r, "0000000", ahora)).toMatchObject({ ok: false, bloqueado: true });
    expect(await intentarAcceso(r, "7654321 LP", ahora)).toMatchObject({ ok: false, bloqueado: true });
    // 15 minutos después vuelve a permitir
    const luego = new Date(ahora.getTime() + 15 * 60_000 + 1000);
    expect(await intentarAcceso(r, "7654321 LP", luego)).toEqual({ ok: true });
  });

  it("un enlace anulado deja de resolverse", async () => {
    const r = (await resolverToken(token))!;
    await withOrg(org, (tx) => anularEnlace(tx, r.enlace.id));
    expect(await resolverToken(token)).toBeNull();
    const [e] = await withOrg(org, (tx) => tx.select().from(enlacesPortal).where(eq(enlacesPortal.id, r.enlace.id)));
    expect(e.token).toBeNull();
  });
});
