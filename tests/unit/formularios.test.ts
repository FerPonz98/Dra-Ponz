import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withOrg } from "@/lib/db";
import { REGLAS_VACIAS } from "@/modules/cobros/dominio/plan";
import { enlacesPortal } from "@/modules/cobros/schema";
import { plantillaCronograma } from "@/modules/tesis/dominio/cronograma";
import { archivosProyecto, respuestasFormulario } from "@/modules/tesis/schema";
import { ErroresFormulario, guardarFormulario, guardarRespuestas, obtenerFormulario, subirArchivosEstudiante, validarRespuestas, type CampoRespuesta } from "@/modules/tesis/servicios/formularios";
import { aceptarPropuesta, enviarPropuesta, guardarPropuesta } from "@/modules/tesis/servicios/propuestas";
import { crearOrgsDePrueba } from "./ayudas";

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a]);
const ZIP = new Uint8Array([0x50, 0x4b, 0x05, 0x06, ...Array(18).fill(0)]);

describe("Formularios: validación de respuestas (puro)", () => {
  const campos: CampoRespuesta[] = [
    { id: "a", tipo: "texto_corto", etiqueta: "Carrera", obligatorio: true, opciones: [] },
    { id: "b", tipo: "fecha", etiqueta: "Fecha de defensa", obligatorio: false, opciones: [] },
    { id: "c", tipo: "seleccion", etiqueta: "Enfoque", obligatorio: true, opciones: ["Cuantitativo", "Cualitativo"] },
    { id: "d", tipo: "archivo", etiqueta: "Perfil", obligatorio: true, opciones: [] },
    { id: "e", tipo: "zip", etiqueta: "Datos", obligatorio: false, opciones: [] },
  ];
  it("exige los obligatorios y valida fecha, selección y tamaño", () => {
    expect(validarRespuestas(campos, { a: "", b: "2026-02-30", c: "Mixto" }, { d: null, e: { name: "x.zip", size: 51 * 1024 * 1024 } })).toEqual({
      a: "Este campo es obligatorio.",
      b: "Fecha inválida.",
      c: "Elige una opción de la lista.",
      d: "Adjunta el archivo.",
      e: "El archivo supera el límite de 50 MB.",
    });
    expect(validarRespuestas(campos, { a: "Bioquímica", b: "", c: "Cualitativo" }, { d: { name: "p.pdf", size: 1000 }, e: null })).toEqual({});
  });
});

describe("Formularios y archivos del estudiante (BD)", () => {
  let org: string;
  let borrar: () => Promise<unknown>;
  beforeAll(async () => {
    const r = await crearOrgsDePrueba(1);
    org = r.orgs[0].id;
    borrar = r.borrar;
  });
  afterAll(async () => borrar());

  it("editar un formulario conserva los ids de los campos existentes", async () => {
    await withOrg(org, async (tx) => {
      const id = await guardarFormulario(tx, org, { nombre: "Datos", campos: [{ tipo: "texto_corto", etiqueta: "Carrera", obligatorio: true }] });
      const f1 = (await obtenerFormulario(tx, id))!;
      await guardarFormulario(tx, org, { nombre: "Datos v2", campos: [{ id: f1.campos[0].id, tipo: "texto_corto", etiqueta: "Carrera (editada)", obligatorio: true }, { tipo: "zip", etiqueta: "Anexos", obligatorio: false }] }, id);
      const f2 = (await obtenerFormulario(tx, id))!;
      expect(f2.nombre).toBe("Datos v2");
      expect(f2.campos[0]).toMatchObject({ id: f1.campos[0].id, etiqueta: "Carrera (editada)" });
      expect(f2.campos[1]).toMatchObject({ tipo: "zip", orden: 2 });
      await expect(guardarFormulario(tx, org, { nombre: "Malo", campos: [{ tipo: "seleccion", etiqueta: "X", obligatorio: true, opciones: ["solo una"] }] })).rejects.toThrow(/2 opciones/);
    });
  });

  it("guarda respuestas con archivo y ZIP; rechaza 51 MB y tipos falsos", async () => {
    await withOrg(org, async (tx) => {
      const actor = { organizacionId: org, usuarioId: null, usuarioNombre: "test" };
      const formId = await guardarFormulario(tx, org, {
        nombre: "Recolección",
        campos: [
          { tipo: "texto_corto", etiqueta: "Carrera", obligatorio: true },
          { tipo: "archivo", etiqueta: "Perfil", obligatorio: true },
          { tipo: "zip", etiqueta: "Base de datos", obligatorio: false },
        ],
      });
      const f = (await obtenerFormulario(tx, formId))!;
      const p = await guardarPropuesta(tx, actor, {
        estudiante: { nuevo: { nombre: "Est Form", ci: "1", whatsapp: "", correo: "" } },
        titulo: "Tesis formulario",
        universidad: "",
        nivel: "posgrado",
        moneda: "BOB",
        cuotas: [{ montoCentavos: 1000, fechaVencimiento: "2026-04-01" }],
        cronograma: { fechaInicio: "2026-04-01", meses: 5, actividades: plantillaCronograma() },
        reglas: REGLAS_VACIAS,
        precioTerceraRevisionCentavos: 0,
        extras: [],
        formularioId: formId,
        vigenciaDias: 7,
      });
      await enviarPropuesta(tx, actor, p.id, "pin");
      await aceptarPropuesta(tx, p.id);
      const [{ id: enlaceId }] = await tx.select({ id: enlacesPortal.id }).from(enlacesPortal).where(eq(enlacesPortal.referenciaId, p.id));

      const fdMalo = new FormData();
      fdMalo.set(`campo_${f.campos[0].id}`, "Educación");
      fdMalo.set(`campo_${f.campos[1].id}`, new File([new Uint8Array(51 * 1024 * 1024)], "perfil.pdf"));
      fdMalo.set(`campo_${f.campos[2].id}`, new File([PDF], "datos.zip"));
      const e = await guardarRespuestas(tx, { organizacionId: org, propuestaId: p.id, enlaceId, fd: fdMalo }).catch((x) => x);
      expect(e).toBeInstanceOf(ErroresFormulario);
      expect(Object.values((e as ErroresFormulario).errores)).toEqual(["perfil.pdf: El archivo supera el límite de 50 MB.", "datos.zip: El contenido del archivo no corresponde a su extensión."]);

      const fd = new FormData();
      fd.set(`campo_${f.campos[0].id}`, "Educación superior");
      fd.set(`campo_${f.campos[1].id}`, new File([PDF], "perfil.pdf"));
      fd.set(`campo_${f.campos[2].id}`, new File([ZIP], "datos.zip"));
      await guardarRespuestas(tx, { organizacionId: org, propuestaId: p.id, enlaceId, fd });
      const [resp] = await tx.select().from(respuestasFormulario).where(eq(respuestasFormulario.propuestaId, p.id));
      expect(resp.valores).toMatchObject({ Carrera: "Educación superior", Perfil: { nombre: "perfil.pdf" }, "Base de datos": { nombre: "datos.zip" } });

      await subirArchivosEstudiante(tx, { organizacionId: org, propuestaId: p.id, enlaceId, archivos: [new File([ZIP], "anexos.zip")], descripcion: "Anexos" });
      await expect(subirArchivosEstudiante(tx, { organizacionId: org, propuestaId: p.id, enlaceId, archivos: [new File([PDF], "virus.exe")], descripcion: null })).rejects.toThrow(/no permitido/);
      const arch = await tx.select().from(archivosProyecto).where(eq(archivosProyecto.propuestaId, p.id));
      expect(arch.map((a) => a.origen).sort()).toEqual(["estudiante", "formulario", "formulario"]);
    });
  });
});
