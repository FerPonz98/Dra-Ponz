import { optimize, type CustomPlugin } from "svgo";

// Sanitizador de SVG subidos (logo e isotipo de cada organización). Usa el parser de SVGO (sax, sin entidades
// externas) y una LISTA BLANCA: todo lo que no está permitido se elimina. Además se rechazan de entrada los SVG
// con scripts o contenido activo, para avisar a quien sube en lugar de "arreglarlo" en silencio.

const ELEMENTOS = new Set([
  "svg", "g", "path", "circle", "ellipse", "rect", "line", "polyline", "polygon", "defs", "title", "desc",
  "linearGradient", "radialGradient", "stop", "clipPath", "mask", "use", "symbol",
]);
const ATRIBUTOS = new Set([
  "xmlns", "viewBox", "width", "height", "x", "y", "x1", "x2", "y1", "y2", "cx", "cy", "r", "rx", "ry", "d", "points",
  "fill", "fill-rule", "fill-opacity", "clip-rule", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin",
  "stroke-miterlimit", "stroke-dasharray", "stroke-dashoffset", "stroke-opacity", "opacity", "transform", "id",
  "clip-path", "mask", "maskUnits", "maskContentUnits", "clipPathUnits", "gradientUnits", "gradientTransform",
  "offset", "stop-color", "stop-opacity", "href", "xlink:href", "xmlns:xlink", "preserveAspectRatio", "role",
  "aria-label", "aria-hidden", "focusable", "spreadMethod", "fx", "fy", "fr", "class", "version",
]);
// Valores que podrían cargar algo de fuera o ejecutar código
const VALOR_PELIGROSO = /javascript:|data:|url\(\s*['"]?\s*(?!#)|expression\(|@import|<|&#/i;

export class SvgNoPermitido extends Error {}

export function sanitizarSvg(entrada: string): { svg: string; eliminados: string[] } {
  if (entrada.length > 512 * 1024) throw new SvgNoPermitido("El SVG es demasiado grande (máx. 512 KB).");
  if (!/<svg[\s>]/i.test(entrada)) throw new SvgNoPermitido("El archivo no es un SVG.");
  if (/<!ENTITY|<!DOCTYPE[^>]*\[/i.test(entrada)) throw new SvgNoPermitido("El SVG declara entidades (no se aceptan).");
  if (/<script|\son[a-z]+\s*=|javascript:|<foreignObject|<iframe|<embed|<object/i.test(entrada)) {
    throw new SvgNoPermitido("El SVG tiene scripts o eventos (on…); expórtalo de nuevo sin código.");
  }
  const eliminados = new Set<string>();
  const listaBlanca: CustomPlugin = {
    name: "listaBlancaMarca",
    fn: () => ({
      element: {
        enter: (nodo, padre) => {
          if (!ELEMENTOS.has(nodo.name)) {
            eliminados.add(`<${nodo.name}>`);
            padre.children = padre.children.filter((c) => c !== nodo);
            return;
          }
          for (const [nombre, valor] of Object.entries(nodo.attributes)) {
            const enlace = nombre === "href" || nombre === "xlink:href";
            if (!ATRIBUTOS.has(nombre) || VALOR_PELIGROSO.test(valor) || (enlace && !valor.startsWith("#"))) {
              eliminados.add(enlace ? "enlace externo" : nombre);
              delete nodo.attributes[nombre];
            }
          }
        },
      },
    }),
  };
  const svg = optimize(entrada, {
    multipass: true,
    plugins: [
      "removeDoctype",
      "removeXMLProcInst",
      "removeComments",
      "removeMetadata",
      "removeEditorsNSData",
      "removeStyleElement", // <style> puede traer @import o url() externos
      "removeScripts",
      listaBlanca,
      { name: "prefixIds", params: { prefix: "marca" } }, // ids únicos al mostrarlo junto a otros SVG
    ],
  }).data;
  if (!/^<svg[\s>]/.test(svg)) throw new SvgNoPermitido("No se pudo leer el SVG.");
  return { svg, eliminados: [...eliminados] };
}
