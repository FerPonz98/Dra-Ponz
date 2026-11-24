// Prepara la marca de la Dra. desde los SVG originales de public/brand/ (01_, 02_, 03_):
//  - limpia y optimiza con SVGO → isotipo.svg, isotipo-geometrico.svg, logo.svg (+ variantes blanca, negra y de contorno)
//  - convierte el texto del logo completo a trazos (Libre Baskerville y Arimo ≈ Arial, en .herramientas/fuentes)
//  - el isotipo geométrico pasa de una "banda" crema pintada a un recorte real (máscara): funciona sobre cualquier fondo
//  - genera los trazos para los componentes React (src/components/marca/trazos.ts)
//  - PNG (correos, íconos de apps), favicon.ico (16/32/48), icon.svg y apple-icon.png
// Uso: node scripts/marca/preparar.mjs   (requiere scripts\auditoria\instalar-herramientas.ps1 para las fuentes)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import opentype from "opentype.js";
import { optimize } from "svgo";

const BRAND = "public/brand";
const FUENTES = ".herramientas/fuentes";
const PRIMARIO = "#1E4D5C";
const ACENTO = "#C59A4A";
const leer = (f) => readFileSync(join(BRAND, f), "utf8");
const svgo = (s, extra = []) =>
  optimize(s, {
    multipass: true,
    floatPrecision: 2,
    // Ids sin acortar ("jp-filo", "jp-geo-corte"…): varios SVG en la misma página no deben chocar.
    plugins: [{ name: "preset-default", params: { overrides: { cleanupIds: { minify: false } } } }, "removeComments", "removeMetadata", ...extra],
  }).data;
const avisos = [];

// ───────── 1) Leer y validar los originales ─────────
const originales = { isotipo: leer("01_monograma_JP.svg"), geometrico: leer("02_geometrico.svg"), logo: leer("03_monograma_JP_con_nombre.svg") };
for (const [n, s] of Object.entries(originales)) {
  if (/<script|\son\w+=|<foreignObject|<image|base64,/i.test(s)) throw new Error(`${n}: contiene scripts, eventos o imágenes incrustadas`);
  if (/<text/i.test(s)) avisos.push(`${n}: tenía ${(s.match(/<text/g) || []).length} <text> (se convirtieron a trazos)`);
  if (/<!--/.test(s)) avisos.push(`${n}: comentarios eliminados`);
}
const d = (s) => [...s.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1]);
const [dJ, dP, dRasgo] = d(originales.isotipo);
const [dGeoA, dGeoB, dGeoC, dGeoBanda] = d(originales.geometrico);
avisos.push("geometrico: la banda curva era una figura rellena color crema (#F7F2E8), no un hueco; ahora es un recorte real (máscara)");

// ───────── 2) Texto del logo completo → trazos ─────────
if (!existsSync(join(FUENTES, "LibreBaskerville.ttf"))) throw new Error("Faltan las fuentes: scripts\\auditoria\\instalar-herramientas.ps1");
const baskerville = opentype.parse(readFileSync(join(FUENTES, "LibreBaskerville.ttf")).buffer);
const arimo = opentype.parse(readFileSync(join(FUENTES, "Arimo.ttf")).buffer);
const trazo = (fuente, texto, x, y, tam, espaciadoPx) => fuente.getPath(texto, x, y, tam, { kerning: true, letterSpacing: espaciadoPx / tam }).toPathData(2);
const dNombre = trazo(baskerville, "Julieta Ponz", 320, 161, 91, -2);
const dLema = trazo(arimo, "INVESTIGACIÓN · DOCENCIA · ASESORÍA", 324, 203, 18, 4);
avisos.push("logo: lema con Arimo (métricas de Arial) a peso 400; el original pedía 500 (la diferencia es mínima a ese tamaño)");

// ───────── 3) SVG finales (color original, blanco, negro, contorno) ─────────
// Monograma: en las versiones de un solo color (blanca/negra) el rasgo se fundiría con la J y la P, así que
// recorta un filo de 7 unidades alrededor suyo en las letras (máscara) para que se siga leyendo.
const monograma = (p, a, id) =>
  p === a
    ? `<defs><mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="400" height="400"><rect width="400" height="400" fill="#fff"/><path fill="#000" stroke="#000" stroke-width="14" stroke-linejoin="round" d="${dRasgo}"/></mask></defs><g mask="url(#${id})"><path fill="${p}" d="${dJ}"/><path fill="${p}" fill-rule="evenodd" d="${dP}"/></g><path fill="${a}" d="${dRasgo}"/>`
    : `<path fill="${p}" d="${dJ}"/><path fill="${p}" fill-rule="evenodd" d="${dP}"/><path fill="${a}" d="${dRasgo}"/>`;
const isotipoSvg = (p, a, titulo = "Dra. Julieta Ponz") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="40 60 330 300" role="img" aria-label="${titulo}"><title>${titulo}</title>${monograma(p, a, "jp-filo")}</svg>`;
const geometricoSvg = (p, a) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="55 55 304 290" role="img" aria-label="Dra. Julieta Ponz"><title>Dra. Julieta Ponz</title><defs><mask id="jp-geo-corte" maskUnits="userSpaceOnUse" x="0" y="0" width="400" height="400"><rect width="400" height="400" fill="#fff"/><path fill="#000" d="${dGeoBanda}"/></mask></defs><g mask="url(#jp-geo-corte)"><path fill="${p}" d="${dGeoA}"/><path fill="${a}" d="${dGeoB}"/><path fill="${p}" d="${dGeoC}"/></g></svg>`;
const logoSvg = (p, a) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="40 48 815 232" role="img" aria-label="Dra. Julieta Ponz — Investigación, Docencia, Asesoría"><title>Dra. Julieta Ponz</title><g transform="translate(10 4) scale(.76)">${monograma(p, a, "jp-filo-logo")}</g><path fill="${p}" d="${dNombre}"/><path fill="${p}" d="${dLema}"/></svg>`;
const contornoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="40 60 330 300" role="img" aria-label="Dra. Julieta Ponz"><title>Dra. Julieta Ponz — contorno</title><g fill="none" stroke="${PRIMARIO}" stroke-width="3" stroke-linejoin="round"><path d="${dJ}"/><path d="${dP}"/><path stroke="${ACENTO}" d="${dRasgo}"/></g></svg>`;

const salidas = {
  "isotipo.svg": isotipoSvg(PRIMARIO, ACENTO),
  "isotipo-blanco.svg": isotipoSvg("#fff", "#fff"),
  "isotipo-negro.svg": isotipoSvg("#000", "#000"),
  "isotipo-contorno.svg": contornoSvg,
  "isotipo-geometrico.svg": geometricoSvg(PRIMARIO, ACENTO),
  "isotipo-geometrico-blanco.svg": geometricoSvg("#fff", "#fff"),
  "isotipo-geometrico-negro.svg": geometricoSvg("#000", "#000"),
  "logo.svg": logoSvg(PRIMARIO, ACENTO),
  "logo-blanco.svg": logoSvg("#fff", "#fff"),
  "logo-negro.svg": logoSvg("#000", "#000"),
};
// Encuadre: el viewBox se ajusta al dibujo real (los originales tenían márgenes vacíos grandes)
const tam = {};
for (const [f, s] of Object.entries(salidas)) {
  const limpio = svgo(s);
  writeFileSync(join(BRAND, f), limpio);
  tam[f] = limpio.length;
}

// ───────── 4) Trazos para los componentes React (colores del tema por CSS) ─────────
const ts = `// GENERADO por scripts/marca/preparar.mjs desde public/brand/0*_*.svg — no editar a mano.
export const VIEWBOX_ISOTIPO = "40 60 330 300";
export const VIEWBOX_GEOMETRICO = "55 55 304 290";
export const VIEWBOX_LOGO = "40 48 815 232";
export const D_J = ${JSON.stringify(dJ)};
export const D_P = ${JSON.stringify(dP)};
export const D_RASGO = ${JSON.stringify(dRasgo)};
export const D_GEO = [${JSON.stringify(dGeoA)}, ${JSON.stringify(dGeoB)}, ${JSON.stringify(dGeoC)}] as const;
export const D_GEO_BANDA = ${JSON.stringify(dGeoBanda)};
export const D_NOMBRE = ${JSON.stringify(dNombre)};
export const D_LEMA = ${JSON.stringify(dLema)};
export const COLOR_MARCA = { primario: "${PRIMARIO}", acento: "${ACENTO}" } as const;
`;
mkdirSync("src/components/marca", { recursive: true });
writeFileSync("src/components/marca/trazos.ts", ts);

// ───────── 5) PNG, favicon e íconos ─────────
const png = (svg, ancho, fondo) => new Resvg(svg, { fitTo: { mode: "width", value: ancho }, background: fondo }).render().asPng();
const conFondo = (svg, color, margen = 0.14) => {
  // Ícono cuadrado: isotipo centrado sobre un fondo de color (para apps y apple-touch-icon)
  const interior = svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "").replace(/<title>.*?<\/title>/, "");
  const lado = 330 / (1 - 2 * margen);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${40 - (lado - 330) / 2} ${60 - (lado - 300) / 2} ${lado} ${lado}"><rect x="-1000" y="-1000" width="3000" height="3000" fill="${color}"/>${interior}</svg>`;
};
const blancoSobrePrimario = conFondo(salidas["isotipo-blanco.svg"].replace(/fill="#fff"/, 'fill="#fff"'), PRIMARIO);
const iconoColor = conFondo(salidas["isotipo.svg"], "#FBF8F2");
writeFileSync(join(BRAND, "logo-correo.png"), png(salidas["logo.svg"], 480)); // 480 px: nítido en correos (se muestra a 240)
writeFileSync(join(BRAND, "isotipo-512.png"), png(salidas["isotipo.svg"], 512));
writeFileSync(join(BRAND, "android-192.png"), png(blancoSobrePrimario, 192));
writeFileSync(join(BRAND, "android-512.png"), png(blancoSobrePrimario, 512));
writeFileSync("src/app/apple-icon.png", png(iconoColor, 180));
writeFileSync("src/app/icon.svg", svgo(conFondo(salidas["isotipo.svg"], "#FBF8F2", 0.08)));

// favicon.ico con 16, 32 y 48 px (PNG dentro del contenedor ICO)
const capas = [16, 32, 48].map((n) => ({ n, datos: png(conFondo(salidas["isotipo.svg"], "#FBF8F2", 0.04), n) }));
const cabecera = Buffer.alloc(6 + 16 * capas.length);
cabecera.writeUInt16LE(0, 0);
cabecera.writeUInt16LE(1, 2);
cabecera.writeUInt16LE(capas.length, 4);
let desplazamiento = cabecera.length;
capas.forEach((c, i) => {
  const o = 6 + 16 * i;
  cabecera.writeUInt8(c.n, o);
  cabecera.writeUInt8(c.n, o + 1);
  cabecera.writeUInt8(0, o + 2);
  cabecera.writeUInt8(0, o + 3);
  cabecera.writeUInt16LE(1, o + 4);
  cabecera.writeUInt16LE(32, o + 6);
  cabecera.writeUInt32LE(c.datos.length, o + 8);
  cabecera.writeUInt32LE(desplazamiento, o + 12);
  desplazamiento += c.datos.length;
});
writeFileSync("src/app/favicon.ico", Buffer.concat([cabecera, ...capas.map((c) => c.datos)]));

console.log("Archivos:", tam);
console.log("Avisos:\n - " + avisos.join("\n - "));
