// Manual de usuario: el Markdown se renderiza seguro, las imágenes se validan y los botones "?" del panel apuntan a
// secciones que existen. No usa la base de datos.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { nombreImagenValido, renderizarMarkdown, seccionesMarkdown } from "@/lib/markdown";

const CARPETA = "docs/manual";
const leer = (f: string) => readFileSync(join(CARPETA, f), "utf8");

function archivosTsx(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? archivosTsx(join(dir, e.name)) : e.name.endsWith(".tsx") ? [join(dir, e.name)] : []));
}

describe("markdown del manual", () => {
  it("escapa HTML y bloquea enlaces javascript:", () => {
    const { html } = renderizarMarkdown('Hola <script>alert(1)</script> [x](javascript:alert(1)) ![a"b](img/x.png)');
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("javascript:");
    expect(html).not.toMatch(/alt="a"b"/);
  });

  it("respeta el número inicial de las listas, los cuadros y el «Para qué sirve»", () => {
    const { html, titulos } = renderizarMarkdown("## Uno {#uno}\n\n**Para qué sirve:** algo.\n\n3. tres\n4. cuatro\n\n> **Consejo:** hazlo.\n\n> **Importante:** cuidado.");
    expect(html).toContain('<ol start="3">');
    expect(html).toContain('class="para-que"');
    expect(html).toContain('class="cuadro consejo"');
    expect(html).toContain('class="cuadro importante"');
    expect(titulos[0]).toEqual({ nivel: 2, texto: "Uno", id: "uno" });
  });

  it("valida el nombre de las imágenes (sin rutas)", () => {
    expect(nombreImagenValido("inicio-panel.png")).toBe(true);
    for (const malo of ["../.env", "..%2f.env", "img/x.png", "x.svg", "X.png", ".png", "a/../b.png"]) expect(nombreImagenValido(malo)).toBe(false);
  });
});

describe("contenido de los manuales", () => {
  const dra = seccionesMarkdown(leer("Manual-Dra-Ponz.md"));
  const ids = new Set(dra.flatMap((s) => [s.id, ...s.subtitulos.map((t) => t.id)]));

  it("el manual de la Dra. tiene las 15 secciones, cada una con «Para qué sirve»", () => {
    expect(dra).toHaveLength(15);
    for (const s of dra) expect(s.html, s.titulo).toContain('class="para-que"');
  });

  it("cada botón «?» del panel lleva a una sección que existe", () => {
    const usados = new Set<string>();
    for (const f of archivosTsx("src/app/panel")) for (const m of readFileSync(f, "utf8").matchAll(/(?:ayuda|seccion)="([a-z-]+)"/g)) usados.add(m[1]);
    expect(usados.size).toBeGreaterThan(10);
    for (const id of usados) expect(ids.has(id), `#${id} no existe en Manual-Dra-Ponz.md`).toBe(true);
  });

  it("todas las imágenes referidas existen y tienen un nombre válido", () => {
    for (const f of ["Manual-Dra-Ponz.md", "Guia-Estudiante-ES.md", "Guia-Estudiante-PT.md"]) {
      for (const m of leer(f).matchAll(/!\[[^\]]*\]\(img\/([^)\s]+)/g)) {
        expect(nombreImagenValido(m[1]), m[1]).toBe(true);
        expect(existsSync(join(CARPETA, "img", m[1])), `${f}: falta img/${m[1]}`).toBe(true);
      }
    }
  });

  it("las guías del estudiante (ES y PT) tienen las mismas secciones y el ancla «si algo falla» del portal", () => {
    const es = seccionesMarkdown(leer("Guia-Estudiante-ES.md")).map((s) => s.id);
    const pt = seccionesMarkdown(leer("Guia-Estudiante-PT.md")).map((s) => s.id);
    expect(pt).toEqual(es);
    expect(es).toContain("si-algo-falla");
  });
});
