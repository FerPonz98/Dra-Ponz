import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withOrg } from "@/lib/db";
import { REGLAS_VACIAS } from "@/modules/cobros/dominio/plan";
import { cuotas, enlacesPortal, planesPago } from "@/modules/cobros/schema";
import { resolverToken } from "@/modules/cobros/servicios/enlaces";
import { avance, mesActual, plantillaCronograma } from "@/modules/tesis/dominio/cronograma";
import { siguienteEstado, type EntradaEstado } from "@/modules/tesis/dominio/estados";
import { cronogramas, propuestas } from "@/modules/tesis/schema";
import {
  aceptarNuevoCronograma,
  aceptarPropuesta,
  enviarPropuesta,
  guardarPropuesta,
  obtenerProyecto,
  proponerNuevoCronograma,
  sincronizarProyecto,
  vencerPropuestas,
  type DatosPropuesta,
} from "@/modules/tesis/servicios/propuestas";
import { crearOrgsDePrueba } from "./ayudas";

describe("Cronograma y estados (puro)", () => {
  it("la plantilla tiene las 9 actividades y la revisión bibliográfica cubre todos los meses", () => {
    const p = plantillaCronograma(5);
    expect(p).toHaveLength(9);
    expect(p[0]).toMatchObject({ nombre: "Revisión bibliográfica", meses: [1, 2, 3, 4, 5] });
    expect(p.find((a) => a.nombre.startsWith("Recolección"))).toMatchObject({ meses: [2], aCargoEstudiante: true });
    expect(p.find((a) => a.nombre.startsWith("Defensa"))).toMatchObject({ meses: [5], aCargoEstudiante: true });
  });
  it("avance = hechas / total y mes actual", () => {
    expect(avance([{ hecha: true }, { hecha: false }, { hecha: true }, { hecha: false }])).toBe(50);
    expect(mesActual("2026-01-15", "2026-01-14", 5)).toBe(0);
    expect(mesActual("2026-01-15", "2026-02-14", 5)).toBe(1);
    expect(mesActual("2026-01-15", "2026-02-15", 5)).toBe(2);
  });

  const base: EntradaEstado = {
    estado: "enviada",
    aceptadaEn: null,
    expiraEn: new Date("2026-03-10T00:00:00Z"),
    primeraCuotaPagada: false,
    estadoMora: "al_dia",
    requiereNuevoCronograma: false,
    cronogramaAceptadoInicio: null,
    hoy: "2026-03-05",
    ahora: new Date("2026-03-05T12:00:00Z"),
  };
  it("enviada → vencida al pasar la vigencia; aceptada requiere 1.ª cuota aprobada", () => {
    expect(siguienteEstado({ ...base, ahora: new Date("2026-03-11T00:00:00Z") }).estado).toBe("vencida");
    expect(siguienteEstado({ ...base, aceptadaEn: new Date(), ahora: new Date("2026-03-11T00:00:00Z") }).estado).toBe("enviada");
    expect(siguienteEstado({ ...base, aceptadaEn: new Date(), primeraCuotaPagada: true }).estado).toBe("aceptada");
  });
  it("en_curso ↔ en_gracia → en_cola → (pago + nuevo cronograma) → en_curso", () => {
    const activo = { ...base, aceptadaEn: new Date(), primeraCuotaPagada: true, cronogramaAceptadoInicio: "2026-03-01" };
    expect(siguienteEstado({ ...activo, estado: "aceptada" }).estado).toBe("en_curso");
    expect(siguienteEstado({ ...activo, estado: "en_curso", estadoMora: "vencida" }).estado).toBe("en_gracia");
    expect(siguienteEstado({ ...activo, estado: "en_gracia", estadoMora: "al_dia" }).estado).toBe("en_curso");
    expect(siguienteEstado({ ...activo, estado: "en_gracia", estadoMora: "en_cola" })).toEqual({ estado: "en_cola", requiereNuevoCronograma: true });
    // pagó pero falta aceptar el cronograma nuevo: sigue en cola
    expect(siguienteEstado({ ...activo, estado: "en_cola", estadoMora: "al_dia", requiereNuevoCronograma: true }).estado).toBe("en_cola");
    expect(siguienteEstado({ ...activo, estado: "en_cola", estadoMora: "al_dia", requiereNuevoCronograma: false }).estado).toBe("en_curso");
    expect(siguienteEstado({ ...activo, estado: "tribunal", estadoMora: "en_cola" }).estado).toBe("tribunal");
  });
});

describe("Vigencia de la propuesta (BD)", () => {
  let org: string;
  let borrar: () => Promise<unknown>;
  const actor = { organizacionId: "", usuarioId: "u", usuarioNombre: "Dra. Test" };
  const datos = (titulo: string): DatosPropuesta => ({
    estudiante: { nuevo: { nombre: "Estudiante Test", ci: "555666", whatsapp: "59170000002", correo: "" } },
    titulo,
    universidad: "UAP",
    nivel: "pregrado",
    moneda: "BOB",
    cuotas: [
      { montoCentavos: 100000, fechaVencimiento: "2026-04-01" },
      { montoCentavos: 100000, fechaVencimiento: "2026-05-01" },
    ],
    cronograma: { fechaInicio: "2026-04-01", meses: 5, actividades: plantillaCronograma(5) },
    reglas: REGLAS_VACIAS,
    precioTerceraRevisionCentavos: 50000,
    extras: [{ nombre: "Diapositivas para la sustentación", precioCentavos: 30000 }],
    formularioId: null,
    vigenciaDias: 7,
  });
  beforeAll(async () => {
    const r = await crearOrgsDePrueba(1);
    org = r.orgs[0].id;
    actor.organizacionId = org;
    borrar = r.borrar;
  });
  afterAll(async () => borrar());

  it("al vencer: el enlace se invalida y la propuesta queda `vencida`, editable y reenviable", async () => {
    const t0 = new Date("2026-03-01T12:00:00Z");
    const { id, token1 } = await withOrg(org, async (tx) => {
      const p = await guardarPropuesta(tx, actor, datos("Tesis vigencia"));
      const e = await enviarPropuesta(tx, actor, p.id, "ci", t0);
      expect(e.expiraEn.toISOString()).toBe("2026-03-08T12:00:00.000Z");
      return { id: p.id, token1: new URL(e.url).pathname.split("/").pop()! };
    });
    expect(await resolverToken(token1, new Date("2026-03-05T00:00:00Z"))).not.toBeNull();

    // pasa la vigencia
    const t1 = new Date("2026-03-09T00:00:00Z");
    expect(await resolverToken(token1, t1)).toBeNull(); // el enlace ya no abre aunque el job no haya corrido
    await withOrg(org, (tx) => vencerPropuestas(tx, t1));
    const [p] = await withOrg(org, (tx) => tx.select().from(propuestas).where(eq(propuestas.id, id)));
    expect(p.estado).toBe("vencida");
    const [enlace] = await withOrg(org, (tx) => tx.select().from(enlacesPortal).where(eq(enlacesPortal.referenciaId, id)));
    expect(enlace.token).toBeNull(); // destruido
    expect(await resolverToken(token1)).toBeNull();

    // editar todo y reenviar
    const token2 = await withOrg(org, async (tx) => {
      const d = datos("Tesis vigencia (editada)");
      d.moneda = "BRL";
      d.cuotas = [{ montoCentavos: 70000, fechaVencimiento: "2026-04-15" }];
      d.extras = [{ nombre: "Revisión de estilo", precioCentavos: 20000 }];
      await guardarPropuesta(tx, actor, d, id);
      const e = await enviarPropuesta(tx, actor, id, "ci", t1);
      return new URL(e.url).pathname.split("/").pop()!;
    });
    expect(token2).not.toBe(token1);
    const pr = (await withOrg(org, (tx) => obtenerProyecto(tx, id)))!;
    expect(pr.propuesta).toMatchObject({ estado: "enviada", titulo: "Tesis vigencia (editada)", vecesEnviada: 2 });
    expect(pr.plan.plan.moneda).toBe("BRL");
    expect(pr.plan.total).toBe(70000);
    expect(pr.extras.map((x) => x.nombre)).toEqual(["Revisión de estilo"]);
    expect(await resolverToken(token2, new Date("2026-03-10T00:00:00Z"))).not.toBeNull();

    // aceptar: guarda fecha y hora, el enlace ya no vence y el plan queda aceptado
    const t2 = new Date("2026-03-10T15:30:00Z");
    await withOrg(org, (tx) => aceptarPropuesta(tx, id, t2));
    const aceptada = (await withOrg(org, (tx) => obtenerProyecto(tx, id)))!;
    expect(aceptada.propuesta.aceptadaEn?.toISOString()).toBe("2026-03-10T15:30:00.000Z");
    expect(aceptada.plan.plan.aceptadoEn?.toISOString()).toBe("2026-03-10T15:30:00.000Z");
    expect(aceptada.vigente?.estado).toBe("aceptado");
    expect(await resolverToken(token2, new Date("2027-01-01T00:00:00Z"))).not.toBeNull();
    // una propuesta aceptada ya no se edita
    await expect(withOrg(org, (tx) => guardarPropuesta(tx, actor, datos("Otro título"), id))).rejects.toThrow(/editar/);
  });

  it("flujo de cola: pago de la 1.ª cuota → aceptada; cola → nuevo cronograma aceptado → en curso", async () => {
    await withOrg(org, async (tx) => {
      const p = await guardarPropuesta(tx, actor, datos("Tesis cola"));
      await enviarPropuesta(tx, actor, p.id, "pin", new Date("2026-03-01T12:00:00Z"));
      await aceptarPropuesta(tx, p.id, new Date("2026-03-02T12:00:00Z"));
      const [c1] = await tx.select().from(cuotas).where(eq(cuotas.planId, p.planId)).orderBy(cuotas.numero).limit(1);
      await tx.update(cuotas).set({ estado: "pagada" }).where(eq(cuotas.id, c1.id));
      expect((await sincronizarProyecto(tx, p.id, "2026-03-02"))?.estado).toBe("aceptada");
      expect((await sincronizarProyecto(tx, p.id, "2026-04-02"))?.estado).toBe("en_curso");
      await tx.update(planesPago).set({ estadoMora: "en_cola" }).where(eq(planesPago.id, p.planId));
      expect(await sincronizarProyecto(tx, p.id, "2026-05-20")).toEqual({ estado: "en_cola", requiereNuevoCronograma: true });
      await tx.update(planesPago).set({ estadoMora: "al_dia" }).where(eq(planesPago.id, p.planId));
      expect((await sincronizarProyecto(tx, p.id, "2026-05-25"))?.estado).toBe("en_cola");
      await proponerNuevoCronograma(tx, actor, p.id, { fechaInicio: "2026-06-01", meses: 5, actividades: plantillaCronograma(5) });
      expect((await aceptarNuevoCronograma(tx, p.id, "2026-06-01"))?.estado).toBe("en_curso");
      const crs = await tx.select().from(cronogramas).where(eq(cronogramas.propuestaId, p.id));
      expect(crs.map((c) => c.estado).sort()).toEqual(["aceptado", "reemplazado"]);
    });
  });
});
