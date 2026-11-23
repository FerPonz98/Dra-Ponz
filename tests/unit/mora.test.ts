import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withOrg } from "@/lib/db";
import { evaluarMora, recargosNuevos, type CuotaMora, type PlanMora } from "@/modules/cobros/dominio/mora";
import { REGLAS_VACIAS, type ReglasMora } from "@/modules/cobros/dominio/plan";
import { cuotas, planesPago, recargos } from "@/modules/cobros/schema";
import { crearCliente } from "@/modules/cobros/servicios/clientes";
import { crearPlan, recalcularMora } from "@/modules/cobros/servicios/planes";
import { crearOrgsDePrueba } from "./ayudas";

const reglas = (r: Partial<ReglasMora>): ReglasMora => ({ ...REGLAS_VACIAS, ...r });
const plan = (r: Partial<ReglasMora>, extra: Partial<PlanMora> = {}): PlanMora => ({ reglas: reglas(r), aceptadoEn: null, numeroMoras: 0, estadoMora: "al_dia", ...extra });
const c1: CuotaMora = { id: "c1", numero: 1, montoCentavos: 100000, fechaVencimiento: "2026-03-10", estado: "pendiente" };
const c2: CuotaMora = { id: "c2", numero: 2, montoCentavos: 100000, fechaVencimiento: "2026-05-10", estado: "pendiente" };

describe("Mora: gracia y paso a cola (fechas simuladas)", () => {
  const p = plan({ diasGracia: 5 });
  it("el día del vencimiento sigue al día", () => {
    expect(evaluarMora(p, [c1], "2026-03-10").estadoMora).toBe("al_dia");
  });
  it("dentro de la gracia queda 'vencida' y empieza la mora n.º 1", () => {
    const r = evaluarMora(p, [c1], "2026-03-15");
    expect(r).toMatchObject({ estadoMora: "vencida", numeroMoras: 1, diasGraciaAplicados: 5, recargos: [] });
  });
  it("al superar la gracia pasa a 'en_cola'", () => {
    expect(evaluarMora(p, [c1], "2026-03-16").estadoMora).toBe("en_cola");
  });
  it("sin reglas (gracia 0) pasa a cola al día siguiente y sin recargo", () => {
    const r = evaluarMora(plan({}), [c1], "2026-03-11");
    expect(r.estadoMora).toBe("en_cola");
    expect(r.recargos).toEqual([]);
  });
  it("una cuota con comprobante en revisión no escala", () => {
    expect(evaluarMora(p, [{ ...c1, pagoEnRevision: true }], "2026-04-30").estadoMora).toBe("al_dia");
  });
});

describe("Mora: recargo único vs mensual", () => {
  it("único: un solo recargo al pasar la gracia, aunque pasen meses", () => {
    const p = plan({ diasGracia: 5, recargoActivo: true, recargoPorcentaje: 10, recargoModo: "unico" });
    expect(evaluarMora(p, [c1], "2026-03-15").recargos).toEqual([]);
    expect(evaluarMora(p, [c1], "2026-03-16").recargos).toEqual([{ cuotaId: "c1", numero: 1, porcentaje: 10, montoCentavos: 10000, aplicadoEn: "2026-03-16" }]);
    expect(evaluarMora(p, [c1], "2026-06-30").recargos).toHaveLength(1);
  });
  it("mensual: un recargo por cada mes (30 días) de atraso pasada la gracia", () => {
    const p = plan({ diasGracia: 5, recargoActivo: true, recargoPorcentaje: 10, recargoModo: "mensual" });
    expect(evaluarMora(p, [c1], "2026-03-16").recargos).toHaveLength(1);
    expect(evaluarMora(p, [c1], "2026-04-14").recargos).toHaveLength(1);
    const r = evaluarMora(p, [c1], "2026-04-15");
    expect(r.recargos.map((x) => [x.numero, x.aplicadoEn, x.montoCentavos])).toEqual([
      [1, "2026-03-16", 10000],
      [2, "2026-04-15", 10000],
    ]);
    expect(evaluarMora(p, [c1], "2026-05-15").recargos).toHaveLength(3);
  });
  it("recargo desactivado: entra en cola sin recargo", () => {
    const r = evaluarMora(plan({ diasGracia: 5, recargoActivo: false, recargoPorcentaje: 10 }), [c1], "2026-04-15");
    expect(r.estadoMora).toBe("en_cola");
    expect(r.recargos).toEqual([]);
  });
  it("plazo para la 1.ª cuota: vence X días después de aceptar y aplica el recargo sin gracia extra", () => {
    const p = plan({ plazoPrimeraCuotaDias: 7, diasGracia: 5, recargoActivo: true, recargoPorcentaje: 5 }, { aceptadoEn: "2026-03-01" });
    expect(evaluarMora(p, [c1], "2026-03-08").estadoMora).toBe("al_dia");
    const r = evaluarMora(p, [c1], "2026-03-09");
    expect(r.estadoMora).toBe("en_cola");
    expect(r.recargos).toEqual([{ cuotaId: "c1", numero: 1, porcentaje: 5, montoCentavos: 5000, aplicadoEn: "2026-03-09" }]);
  });
});

describe("Mora: salida de la cola y nueva mora con más días de gracia", () => {
  const r0 = { diasGracia: 5, diasGraciaNuevaMora: 10 };
  it("al pagar sale de la cola y vuelve a 'al_dia' conservando el contador de moras", () => {
    const enCola = plan(r0, { estadoMora: "en_cola", numeroMoras: 1 });
    const r = evaluarMora(enCola, [{ ...c1, estado: "pagada" }, c2], "2026-04-20");
    expect(r).toMatchObject({ estadoMora: "al_dia", numeroMoras: 1 });
  });
  it("la siguiente mora usa la gracia de 'nueva mora' (10 días en vez de 5)", () => {
    const tras = plan(r0, { estadoMora: "al_dia", numeroMoras: 1 });
    const pagada = { ...c1, estado: "pagada" as const };
    const r = evaluarMora(tras, [pagada, c2], "2026-05-17"); // 7 días de atraso
    expect(r).toMatchObject({ estadoMora: "vencida", numeroMoras: 2, diasGraciaAplicados: 10 });
    // con la gracia original (5) ya estaría en cola
    expect(evaluarMora(plan(r0), [c2], "2026-05-17").estadoMora).toBe("en_cola");
    expect(evaluarMora({ ...tras, estadoMora: "vencida", numeroMoras: 2 }, [pagada, c2], "2026-05-21").estadoMora).toBe("en_cola");
  });
  it("si no se definió gracia de nueva mora, usa la normal", () => {
    const r = evaluarMora(plan({ diasGracia: 5 }, { numeroMoras: 1 }), [{ ...c1, estado: "pagada" }, c2], "2026-05-16");
    expect(r).toMatchObject({ estadoMora: "en_cola", diasGraciaAplicados: 5 });
  });
});

describe("Mora: idempotencia", () => {
  it("evaluar dos veces el mismo día no suma moras ni recargos nuevos", () => {
    const p = plan({ diasGracia: 5, recargoActivo: true, recargoPorcentaje: 10, recargoModo: "mensual" });
    const a = evaluarMora(p, [c1], "2026-04-15");
    const b = evaluarMora({ ...p, estadoMora: a.estadoMora, numeroMoras: a.numeroMoras }, [c1], "2026-04-15");
    expect(b.numeroMoras).toBe(a.numeroMoras);
    expect(recargosNuevos(b.recargos, a.recargos)).toEqual([]);
  });

  describe("job en la BD", () => {
    let org: string;
    let borrar: () => Promise<unknown>;
    beforeAll(async () => {
      const r = await crearOrgsDePrueba(1);
      org = r.orgs[0].id;
      borrar = r.borrar;
    });
    afterAll(async () => borrar());

    it("recalcular dos veces el mismo día no duplica recargos; al pagar sale de la cola", async () => {
      await withOrg(org, async (tx) => {
        const actor = { organizacionId: org, usuarioId: null, usuarioNombre: "test" };
        const c = await crearCliente(tx, org, { nombre: "Moroso" });
        const p = await crearPlan(tx, actor, {
          clienteId: c.id,
          titulo: "Plan mora",
          moneda: "BOB",
          cuotas: [
            { montoCentavos: 100000, fechaVencimiento: "2026-03-10" },
            { montoCentavos: 100000, fechaVencimiento: "2026-05-10" },
          ],
          reglas: reglas({ diasGracia: 5, diasGraciaNuevaMora: 10, recargoActivo: true, recargoPorcentaje: 10, recargoModo: "mensual" }),
        });
        const a = await recalcularMora(tx, p.id, "2026-04-15");
        const b = await recalcularMora(tx, p.id, "2026-04-15");
        expect(a).toMatchObject({ estadoMora: "en_cola", recargosAgregados: 2 });
        expect(b).toMatchObject({ estadoMora: "en_cola", recargosAgregados: 0 });
        const recs = await tx.select().from(recargos);
        expect(recs).toHaveLength(2);
        let [fila] = await tx.select().from(planesPago).where(eq(planesPago.id, p.id));
        expect(fila).toMatchObject({ estadoMora: "en_cola", numeroMoras: 1 });

        await tx.update(cuotas).set({ estado: "pagada" }).where(eq(cuotas.numero, 1));
        expect(await recalcularMora(tx, p.id, "2026-04-20")).toMatchObject({ estadoMora: "al_dia" });
        expect(await recalcularMora(tx, p.id, "2026-05-17")).toMatchObject({ estadoMora: "vencida", numeroMoras: 2 });
        [fila] = await tx.select().from(planesPago).where(eq(planesPago.id, p.id));
        expect(fila.numeroMoras).toBe(2);
      });
    });
  });
});
