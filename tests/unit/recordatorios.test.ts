import { readdirSync, rmSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { organizacionModulos } from "@/core/db/schema";
import { withAdmin, withOrg } from "@/lib/db";
import { rellenarPlantilla, urlWhatsApp } from "@/modules/cobros/dominio/mensajes";
import { crearCliente } from "@/modules/cobros/servicios/clientes";
import { jobMoraYRecordatorios } from "@/modules/cobros/servicios/jobs";
import { recordatoriosDeHoy } from "@/modules/cobros/servicios/panel";
import { crearPlan } from "@/modules/cobros/servicios/planes";
import { crearOrgsDePrueba } from "./ayudas";

describe("Plantillas y WhatsApp", () => {
  it("rellena las variables", () => {
    expect(rellenarPlantilla("Hola {nombre}, {monto} {moneda} el {fecha}: {enlace} ({proyecto}) {otra}", { nombre: "Ana", monto: "100.00", moneda: "BOB", fecha: "01/02/2026", enlace: "https://x/p/t", proyecto: "Tesis" })).toBe(
      "Hola Ana, 100.00 BOB el 01/02/2026: https://x/p/t (Tesis) {otra}",
    );
  });
  it("arma el enlace wa.me con el mensaje codificado", () => {
    expect(urlWhatsApp("+591 7123-4567", "Hola Ana & Co")).toBe("https://wa.me/59171234567?text=Hola%20Ana%20%26%20Co");
  });
});

describe("Recordatorios: lista del día y correos idempotentes", () => {
  let org: string;
  let borrar: () => Promise<unknown>;
  const dirCorreos = ".data/correos";
  const correos = () => {
    try {
      return readdirSync(dirCorreos).filter((f) => f.includes("recordatorio_test"));
    } catch {
      return [];
    }
  };
  beforeAll(async () => {
    const r = await crearOrgsDePrueba(1);
    org = r.orgs[0].id;
    borrar = r.borrar;
    await withAdmin((tx) => tx.insert(organizacionModulos).values({ organizacionId: org, modulo: "cobros", activo: true }));
    await withOrg(org, async (tx) => {
      const actor = { organizacionId: org, usuarioId: null, usuarioNombre: "test" };
      const c = await crearCliente(tx, org, { nombre: "Recordado", correo: "recordatorio-test@example.com", whatsapp: "59170000000" });
      await crearPlan(tx, actor, {
        clienteId: c.id,
        titulo: "Plan recordatorios",
        moneda: "BOB",
        cuotas: [
          { montoCentavos: 1000, fechaVencimiento: "2026-03-01" }, // vencida
          { montoCentavos: 2000, fechaVencimiento: "2026-03-10" }, // hoy
          { montoCentavos: 3000, fechaVencimiento: "2026-03-13" }, // en 3 días
          { montoCentavos: 4000, fechaVencimiento: "2026-04-10" }, // lejos
        ],
        reglas: { plazoPrimeraCuotaDias: null, diasGracia: 30, recargoActivo: false, recargoPorcentaje: null, recargoModo: "unico", diasGraciaNuevaMora: null },
      });
    });
    for (const f of correos()) rmSync(`${dirCorreos}/${f}`);
  });
  afterAll(async () => {
    for (const f of correos()) rmSync(`${dirCorreos}/${f}`);
    await borrar();
  });

  it("clasifica las cuotas para recordar hoy", async () => {
    const lista = await withOrg(org, (tx) => recordatoriosDeHoy(tx, "2026-03-10"));
    expect(lista.map((x) => [x.numero, x.categoria])).toEqual([
      [1, "vencida"],
      [2, "vence_hoy"],
      [3, "vence_en_3_dias"],
    ]);
    expect(lista[1].mensaje).toContain("Recordado");
  });

  it("envía el correo de 3 días antes y el del día una sola vez aunque el job corra dos veces", async () => {
    const ahora = new Date("2026-03-10T11:00:00Z"); // 07:00 en La Paz
    const r1 = await jobMoraYRecordatorios(ahora, org);
    const r2 = await jobMoraYRecordatorios(ahora, org);
    expect(r1[0].correos).toBe(2);
    expect(r2[0].correos).toBe(0);
    expect(correos()).toHaveLength(2);
  });
});
