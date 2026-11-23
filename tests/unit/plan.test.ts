import { asc, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withOrg } from "@/lib/db";
import { calcularCambiosCuotas, calcularTotal, generarCuotas } from "@/modules/cobros/dominio/plan";
import { cuotas, historialPlan } from "@/modules/cobros/schema";
import { crearCliente } from "@/modules/cobros/servicios/clientes";
import { crearPlan, guardarCuotas, obtenerPlanCompleto } from "@/modules/cobros/servicios/planes";
import { crearOrgsDePrueba } from "./ayudas";

describe("Plan de pagos: total y cuotas (puro)", () => {
  it("el total es la suma de las cuotas", () => {
    expect(calcularTotal([{ montoCentavos: 50000 }, { montoCentavos: 30050 }, { montoCentavos: 19950 }])).toBe(100000);
  });

  it("generar cuotas reparte el total y deja el resto de centavos en la última", () => {
    const c = generarCuotas(3, 100000, "2026-01-31");
    expect(c.map((x) => x.montoCentavos)).toEqual([33333, 33333, 33334]);
    expect(calcularTotal(c)).toBe(100000);
    expect(c.map((x) => x.fechaVencimiento)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
  });

  it("detecta montos y fechas editados, cuotas agregadas y quitadas, con valor antes y después", () => {
    const antes = [
      { id: "a", numero: 1, montoCentavos: 10000, fechaVencimiento: "2026-01-10", estado: "pagada" as const },
      { id: "b", numero: 2, montoCentavos: 10000, fechaVencimiento: "2026-02-10", estado: "pendiente" as const },
      { id: "c", numero: 3, montoCentavos: 10000, fechaVencimiento: "2026-03-10", estado: "pendiente" as const },
    ];
    const r = calcularCambiosCuotas(antes, [
      { id: "a", montoCentavos: 10000, fechaVencimiento: "2025-12-01" }, // fecha pasada editable aunque esté pagada
      { id: "b", montoCentavos: 15000, fechaVencimiento: "2026-02-10" },
      { montoCentavos: 5000, fechaVencimiento: "2026-04-10" },
    ]);
    expect(r.eliminar).toEqual(["c"]);
    expect(r.crear).toHaveLength(1);
    expect(r.historial).toEqual(
      expect.arrayContaining([
        { cuotaId: "a", campo: "cuota 1 · fecha", valorAntes: "2026-01-10", valorDespues: "2025-12-01" },
        { cuotaId: "b", campo: "cuota 2 · monto", valorAntes: "100.00", valorDespues: "150.00" },
        expect.objectContaining({ campo: "cuota agregada" }),
        expect.objectContaining({ cuotaId: "c", campo: "cuota quitada" }),
      ]),
    );
    // el total no cambió (300 → 300), así que no hay entrada de total
    expect(r.historial.some((h) => h.campo === "total")).toBe(false);
  });

  it("no permite cambiar el monto ni quitar una cuota pagada", () => {
    const antes = [{ id: "a", numero: 1, montoCentavos: 10000, fechaVencimiento: "2026-01-10", estado: "pagada" as const }];
    expect(() => calcularCambiosCuotas(antes, [{ id: "a", montoCentavos: 9000, fechaVencimiento: "2026-01-10" }])).toThrow(/pagada/);
    expect(() => calcularCambiosCuotas(antes, [{ montoCentavos: 9000, fechaVencimiento: "2026-01-10" }])).toThrow(/pagada/);
  });
});

describe("Plan de pagos: edición con historial (BD)", () => {
  let org: string;
  let borrar: () => Promise<unknown>;
  beforeAll(async () => {
    const r = await crearOrgsDePrueba(1);
    org = r.orgs[0].id;
    borrar = r.borrar;
  });
  afterAll(async () => borrar());

  it("crea el plan, edita cuotas en curso y guarda quién/cuándo/antes/después", async () => {
    const actor = { organizacionId: "", usuarioId: "u-1", usuarioNombre: "Dra. Prueba" };
    await withOrg(org, async (tx) => {
      actor.organizacionId = org;
      const cli = await crearCliente(tx, org, { nombre: "Ana Pérez", ci: "1234567" });
      const plan = await crearPlan(tx, actor, {
        clienteId: cli.id,
        titulo: "Tratamiento",
        moneda: "BOB",
        cuotas: generarCuotas(3, 300000, "2026-01-15"),
      });
      const inicial = await obtenerPlanCompleto(tx, plan.id);
      expect(inicial!.total).toBe(300000);

      const lista = await tx.select().from(cuotas).where(eq(cuotas.planId, plan.id)).orderBy(asc(cuotas.numero));
      await tx.update(cuotas).set({ estado: "pagada" }).where(eq(cuotas.id, lista[0].id));
      await guardarCuotas(tx, actor, plan.id, [
        { id: lista[0].id, montoCentavos: lista[0].montoCentavos, fechaVencimiento: "2025-12-20" },
        { id: lista[1].id, montoCentavos: 120000, fechaVencimiento: lista[1].fechaVencimiento },
        { montoCentavos: 80000, fechaVencimiento: "2026-05-15" },
      ]);
      const final = await obtenerPlanCompleto(tx, plan.id);
      expect(final!.cuotas.map((c) => c.montoCentavos)).toEqual([100000, 120000, 80000]);
      expect(final!.total).toBe(300000);

      const h = await tx.select().from(historialPlan).where(eq(historialPlan.planId, plan.id));
      const monto = h.find((x) => x.campo === "cuota 2 · monto")!;
      expect(monto).toMatchObject({ valorAntes: "1000.00", valorDespues: "1200.00", usuarioId: "u-1", usuarioNombre: "Dra. Prueba" });
      expect(monto.creadoEn).toBeInstanceOf(Date);
      expect(h.some((x) => x.campo === "cuota 1 · fecha" && x.valorDespues === "2025-12-20")).toBe(true);
      expect(h.some((x) => x.campo === "cuota quitada")).toBe(true);
      expect(h.some((x) => x.campo === "cuota agregada")).toBe(true);
    });
  });
});
