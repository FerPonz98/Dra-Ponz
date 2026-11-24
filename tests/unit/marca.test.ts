import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { marcaDe } from "@/core/marca/marca";
import { sanitizarSvg, SvgNoPermitido } from "@/core/marca/sanitizar-svg";

const limpio = (svg: string) => sanitizarSvg(svg).svg;

describe("Marca: sanitizador de SVG subidos", () => {
  it("acepta los SVG de la marca sin cambiar el dibujo", () => {
    for (const f of ["isotipo.svg", "isotipo-geometrico.svg", "logo.svg"]) {
      const original = readFileSync(`public/brand/${f}`, "utf8");
      const r = sanitizarSvg(original);
      expect(r.svg, f).toMatch(/^<svg/);
      expect((r.svg.match(/<path/g) ?? []).length, f).toBe((original.match(/<path/g) ?? []).length);
    }
  });

  it("rechaza scripts, eventos on*, javascript:, foreignObject y entidades", () => {
    const malos = [
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><path d="M0 0h1"/></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)"><path d="M0 0h1"/></a></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><iframe src="https://x"/></foreignObject></svg>',
      '<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg xmlns="http://www.w3.org/2000/svg"><text>&x;</text></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg"><path ONMOUSEOVER="alert(1)" d="M0 0h1"/></svg>',
      "no soy un svg",
    ];
    for (const m of malos) expect(() => sanitizarSvg(m), m.slice(0, 60)).toThrow(SvgNoPermitido);
  });

  it("quita enlaces externos, <image>, <style>, <a>, animaciones y url() externas, y avisa qué quitó", () => {
    const r = sanitizarSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 10 10">' +
        '<style>@import url(https://malo.example/x.css);</style>' +
        '<image href="https://malo.example/rastreo.png" width="1" height="1"/>' +
        '<use xlink:href="https://malo.example/s.svg#a"/>' +
        '<use href="#local"/>' +
        '<a href="https://malo.example"><path d="M0 0h5"/></a>' +
        '<animate attributeName="href" to="https://x"/>' +
        '<path id="local" fill="url(https://malo.example/f)" style="fill:red" d="M0 0h10v10z"/>' +
        "</svg>",
    );
    expect(r.svg).not.toMatch(/malo\.example|<style|<image|<a[\s>]|<animate|@import/);
    expect(r.svg).toContain('href="#'); // las referencias internas se conservan
    expect(r.eliminados.length).toBeGreaterThan(0);
  });

  it("prefija los ids para que no choquen con otros SVG de la página", () => {
    expect(limpio('<svg xmlns="http://www.w3.org/2000/svg"><defs><mask id="a"><rect width="1" height="1"/></mask></defs><path mask="url(#a)" d="M0 0h1"/></svg>')).toMatch(/id="marca[^"]*a"/);
  });
});

describe("Marca: qué se muestra en cada organización", () => {
  const base = { id: "00000000-0000-0000-0000-000000000001", nombre: "Dra. Elizabeth Julieta Ponz Sejas", logoArchivoId: null, isotipoArchivoId: null };
  it("la Dra. tiene su monograma por defecto; otra organización, su inicial", () => {
    expect(marcaDe({ ...base, slug: "dra-ponz" }).tipo).toBe("incorporada");
    expect(marcaDe({ ...base, slug: "demo-dentista", nombre: "Demo Dentista" })).toMatchObject({ tipo: "inicial", letra: "D" });
  });
  it("lo subido reemplaza al valor por defecto", () => {
    const m = marcaDe({ ...base, slug: "dra-ponz", logoArchivoId: crypto.randomUUID() });
    expect(m).toMatchObject({ tipo: "archivo", logo: `/marca/${base.id}/logo`, isotipo: null });
  });
});
