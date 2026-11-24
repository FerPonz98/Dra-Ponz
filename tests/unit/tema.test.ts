import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { organizacionTema } from "@/core/db/schema";
import { contraste } from "@/core/tema/colores";
import { guardarTema, obtenerTema, temaGuardado } from "@/core/tema/servicio";
import { cssTema, derivarColores, esquemaTema, PRESETS, TEMA_POR_DEFECTO, variablesTema, verificarContraste, type Tema } from "@/core/tema/tema";
import { withAdmin, withOrg } from "@/lib/db";
import { crearOrgsDePrueba } from "./ayudas";

const AZUL: Tema = { ...PRESETS.find((p) => p.id === "institucional")!.tema, preset: "institucional" };
const VINO: Tema = { ...PRESETS.find((p) => p.id === "vino")!.tema, preset: "vino" };

describe("Tema: colores, variantes y contraste (puro)", () => {
  it("todos los presets cumplen el contraste AA (sin avisos)", () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(6);
    expect(PRESETS.length).toBeLessThanOrEqual(8);
    for (const p of PRESETS) {
      const fallos = verificarContraste(p.tema).filter((v) => !v.ok);
      expect(fallos, p.id).toEqual([]);
    }
  });

  it("el tema por defecto son los colores actuales de la Dra.", () => {
    expect(TEMA_POR_DEFECTO).toMatchObject({ colorPrimario: "#0e4a55", colorSecundario: "#0a3640", colorFondo: "#faf6ee", colorTexto: "#1d2a2e", fuenteTitulos: "fraunces" });
  });

  it("genera las variantes desde el color base y todas las de texto son legibles", () => {
    for (const p of PRESETS) {
      const c = derivarColores(p.tema);
      expect(c.primarioHover).not.toBe(c.primario);
      expect(contraste(c.sobrePrimario, c.primario)).toBeGreaterThanOrEqual(4.5);
      expect(contraste(c.sobrePrimario, c.primarioHover)).toBeGreaterThanOrEqual(4.5);
      for (const sup of [c.fondo, c.superficie, c.fondo2, c.primarioSuave, c.acentoSuave, c.acentoFuerte]) {
        expect(contraste(c.textoSuave, sup), `${p.id} texto suave`).toBeGreaterThanOrEqual(4.5);
        expect(contraste(c.titulo, sup), `${p.id} título`).toBeGreaterThanOrEqual(4.5);
        expect(contraste(c.acentoTexto, sup), `${p.id} acento texto`).toBeGreaterThanOrEqual(4.5);
      }
      expect(contraste(c.acentoSobreSecundario, c.secundario)).toBeGreaterThanOrEqual(4.5);
      expect(contraste(c.sobreSecundarioSuave, c.secundario)).toBeGreaterThanOrEqual(4.5);
    }
    const v = variablesTema(AZUL);
    for (const k of ["--color-primario", "--color-primario-hover", "--color-primario-suave", "--color-primario-borde", "--color-sobre-primario"] as const) expect(v[k]).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("rechaza combinaciones ilegibles y propone una corrección que sí cumple", () => {
    const ilegible = { ...TEMA_POR_DEFECTO, colorPrimario: "#f2e6c9" }; // botón crema sobre fondo crema
    const r = esquemaTema.safeParse(ilegible);
    expect(r.success).toBe(false);
    const fallo = verificarContraste(ilegible).find((v) => v.id === "boton-fondo")!;
    expect(fallo.ok).toBe(false);
    expect(fallo.bloqueante).toBe(true);
    const corregido = { ...ilegible, [fallo.sugerencia!.campo]: fallo.sugerencia!.valor };
    expect(esquemaTema.safeParse(corregido).success).toBe(true);

    expect(esquemaTema.safeParse({ ...TEMA_POR_DEFECTO, colorTexto: "#d9d4c8" }).success).toBe(false); // texto claro sobre fondo claro
    expect(esquemaTema.safeParse({ ...TEMA_POR_DEFECTO, colorPrimario: "red" }).success).toBe(false);
    expect(esquemaTema.safeParse({ ...TEMA_POR_DEFECTO, fuenteTitulos: "comic-sans" }).success).toBe(false);
  });

  it("el CSS generado solo contiene valores del catálogo (sin inyección)", () => {
    const css = cssTema(AZUL, "portal");
    expect(css).toContain(":root{--color-primario:#1d4ed8");
    expect(css).toContain(".tema-fuentes{--fuente-titulos:var(--font-source-serif)");
    expect(css).toContain(":root:not(.dark){--background:#f8fafc");
    expect(css).not.toMatch(/[<>{}]\s*[<>]/);
    expect(cssTema(AZUL, "panel")).toMatch(/^:root:not\(\.dark\)\{--primary:#1d4ed8;/);
  });
});

describe("Tema: guardado y aislamiento entre organizaciones (RLS)", () => {
  let A: string;
  let B: string;
  let borrar: () => Promise<unknown>;

  beforeAll(async () => {
    const r = await crearOrgsDePrueba(2);
    [A, B] = r.orgs.map((o) => o.id);
    borrar = r.borrar;
  });
  afterAll(async () => borrar());

  it("sin tema guardado usa el tema por defecto", async () => {
    expect(await withOrg(A, temaGuardado)).toBeNull();
    expect(await withOrg(A, obtenerTema)).toEqual(TEMA_POR_DEFECTO);
  });

  it("guardar un tema cambia las variables CSS de la landing", async () => {
    const antes = cssTema(await withOrg(A, obtenerTema), "landing");
    expect(antes).toContain("--color-primario:#0e4a55");
    const t = await withOrg(A, (tx) => guardarTema(tx, A, { ...AZUL, preset: null }));
    expect(t.preset).toBe("institucional"); // se detecta el preset
    const despues = cssTema(await withOrg(A, obtenerTema), "landing");
    expect(despues).toContain("--color-primario:#1d4ed8");
    expect(despues).toContain("--fuente-titulos:var(--font-source-serif)");
    expect(despues).not.toBe(antes);
  });

  it("el contraste inválido se rechaza y no se guarda nada", async () => {
    await expect(withOrg(A, (tx) => guardarTema(tx, A, { ...AZUL, colorFondo: "#1d4ed8" }))).rejects.toBeInstanceOf(ZodError);
    expect((await withOrg(A, obtenerTema)).colorFondo).toBe(AZUL.colorFondo);
  });

  it("la organización A no puede ver ni editar el tema de la B", async () => {
    await withOrg(B, (tx) => guardarTema(tx, B, VINO));
    // A solo ve el suyo
    const visibles = await withOrg(A, (tx) => tx.select().from(organizacionTema));
    expect(visibles.map((f) => f.organizacionId)).toEqual([A]);
    expect((await withOrg(A, obtenerTema)).colorPrimario).toBe(AZUL.colorPrimario);
    // A no puede escribir el de B (ni insertar ni actualizar)
    await expect(withOrg(A, (tx) => guardarTema(tx, B, AZUL))).rejects.toThrow();
    const actualizadas = await withOrg(A, (tx) => tx.update(organizacionTema).set({ colorPrimario: "#000000" }).where(eq(organizacionTema.organizacionId, B)).returning());
    expect(actualizadas).toHaveLength(0);
    const [deB] = await withAdmin((tx) => tx.select().from(organizacionTema).where(eq(organizacionTema.organizacionId, B)));
    expect(deB.colorPrimario).toBe(VINO.colorPrimario);
  });
});
