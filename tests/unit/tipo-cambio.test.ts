import { readFileSync } from "node:fs";
import { and, eq, gte, lte } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { alertasSistema } from "@/core/db/schema";
import { withAdmin } from "@/lib/db";
import { convertirABob, elegirCotizacion, parsearBcb } from "@/modules/cobros/dominio/tipo-cambio";
import { tiposCambio } from "@/modules/cobros/schema";
import { actualizarTipoCambio, cotizacionBrl } from "@/modules/cobros/servicios/tipo-cambio";

const html = readFileSync("tests/fixtures/bcb-ultimo.html", "utf8");

describe("Tipo de cambio BRL→BOB", () => {
  it("lee la cotización BRL y la fecha de la tabla del BCB", () => {
    expect(parsearBcb(html)).toEqual({ fecha: "2026-11-22", valor: 1.97798 });
  });
  it("falla con un HTML sin la fila BRL", () => {
    expect(() => parsearBcb("<html>mantenimiento</html>")).toThrow(/BRL/);
  });
  it("convierte con la cotización del día (BOB no cambia)", () => {
    expect(convertirABob(35000, "BRL", 1.97798)).toBe(69229); // R$ 350,00 → Bs 692,29
    expect(convertirABob(35000, "BOB", null)).toBe(35000);
    expect(() => convertirABob(100, "BRL", null)).toThrow();
  });
  it("usa la del día; si no hay, la última guardada como respaldo", () => {
    const c = [
      { fecha: "2026-01-08", valor: 1.9 },
      { fecha: "2026-01-09", valor: 1.95 },
      { fecha: "2026-01-12", valor: 2.0 }, // futura respecto de 'hoy'
    ];
    expect(elegirCotizacion(c, "2026-01-09")).toEqual({ cotizacion: { fecha: "2026-01-09", valor: 1.95 }, esRespaldo: false });
    expect(elegirCotizacion(c, "2026-01-11")).toEqual({ cotizacion: { fecha: "2026-01-09", valor: 1.95 }, esRespaldo: true });
    expect(elegirCotizacion([], "2026-01-11")).toEqual({ cotizacion: null, esRespaldo: false });
  });

  describe("job en la BD (fechas de prueba en 1999)", () => {
    afterAll(async () => {
      await withAdmin(async (tx) => {
        await tx.delete(tiposCambio).where(and(gte(tiposCambio.fecha, "1999-01-01"), lte(tiposCambio.fecha, "1999-12-31")));
        await tx.delete(alertasSistema).where(eq(alertasSistema.tipo, "tipo_cambio"));
      });
    });

    it("guarda la cotización; si el BCB falla registra una alerta y se usa la última guardada", async () => {
      const ok = await withAdmin((tx) => actualizarTipoCambio(tx, "1999-06-01", async () => html));
      expect(ok).toEqual({ ok: true, valor: 1.97798 });
      // idempotente: correr de nuevo el mismo día no duplica
      await withAdmin((tx) => actualizarTipoCambio(tx, "1999-06-01", async () => html));
      const filas = await withAdmin((tx) => tx.select().from(tiposCambio).where(eq(tiposCambio.fecha, "1999-06-01")));
      expect(filas).toHaveLength(1);

      const mal = await withAdmin((tx) =>
        actualizarTipoCambio(tx, "1999-06-02", async () => {
          throw new Error("timeout");
        }),
      );
      expect(mal.ok).toBe(false);
      const alertas = await withAdmin((tx) => tx.select().from(alertasSistema).where(and(eq(alertasSistema.tipo, "tipo_cambio"), eq(alertasSistema.resuelta, false))));
      expect(alertas.length).toBeGreaterThan(0);
      const c = await withAdmin((tx) => cotizacionBrl(tx, "1999-06-02"));
      expect(c).toEqual({ cotizacion: { fecha: "1999-06-01", valor: 1.97798 }, esRespaldo: true });
    });
  });
});
