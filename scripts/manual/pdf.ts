// npm run manual:pdf — genera los PDF de los manuales desde docs/manual/*.md:
//   Manual-Dra-Ponz.pdf · Guia-Estudiante-ES.pdf · Guia-Estudiante-PT.pdf · Manual-Tecnico.pdf
// Portada con la marca de la Dra., índice con números de página y contenido con las capturas.
// El índice se arma en dos pasadas: la 1.ª genera el PDF y ubica en qué página cayó cada título (pdf.js);
// la 2.ª vuelve a generarlo con esos números.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, type Page } from "@playwright/test";
import { escaparHtml, renderizarMarkdown, type Titulo } from "../../src/lib/markdown";

const CARPETA = resolve("docs/manual");
const MARCA = { primario: "#1E4D5C", oscuro: "#0E3A45", acento: "#C59A4A", crema: "#FAF6EE", texto: "#1F2A30" };

type Def = { md: string; pdf: string; titulo: string; subtitulo: string; publico: string; idioma: "es" | "pt"; niveles: number[]; movil?: boolean };
const MANUALES: Def[] = [
  { md: "Manual-Dra-Ponz.md", pdf: "Manual-Dra-Ponz.pdf", titulo: "Manual de uso del panel", subtitulo: "Cobros y asesoría de tesis, paso a paso", publico: "Para la Dra. Julieta Ponz", idioma: "es", niveles: [2, 3] },
  { md: "Guia-Estudiante-ES.md", pdf: "Guia-Estudiante-ES.pdf", titulo: "Guía del estudiante", subtitulo: "Tu enlace personal, desde el celular", publico: "Para estudiantes de la Dra. Julieta Ponz", idioma: "es", niveles: [2], movil: true },
  { md: "Guia-Estudiante-PT.md", pdf: "Guia-Estudiante-PT.pdf", titulo: "Guia do estudante", subtitulo: "O seu link pessoal, no celular", publico: "Para os estudantes da Dra. Julieta Ponz", idioma: "pt", niveles: [2], movil: true },
  { md: "Manual-Tecnico.md", pdf: "Manual-Tecnico.pdf", titulo: "Manual técnico", subtitulo: "Despliegue, respaldos y mantenimiento", publico: "Para Fernando (administración del sistema)", idioma: "es", niveles: [2] },
];

const fechaVersion = (idioma: "es" | "pt") => new Intl.DateTimeFormat(idioma === "pt" ? "pt-BR" : "es-BO", { month: "long", year: "numeric" }).format(new Date());

function estilos(movil?: boolean) {
  return `
  @page { size: A4; margin: 18mm 17mm 20mm 17mm; }
  @page :first { margin: 0; }
  * { box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif; color: ${MARCA.texto}; font-size: 10.5pt; line-height: 1.55; }
  .portada { position: relative; height: 297mm; width: 210mm; background: ${MARCA.oscuro}; color: #fff; overflow: hidden; page-break-after: always; }
  .portada .mancha1 { position: absolute; right: -60mm; top: -50mm; width: 170mm; height: 170mm; border-radius: 50%; background: radial-gradient(circle, ${MARCA.primario} 0%, transparent 70%); }
  .portada .mancha2 { position: absolute; left: -50mm; bottom: -60mm; width: 160mm; height: 160mm; border-radius: 50%; background: radial-gradient(circle, rgba(197,154,74,.35) 0%, transparent 70%); }
  .portada .contenido { position: absolute; left: 24mm; right: 24mm; top: 30mm; bottom: 26mm; display: flex; flex-direction: column; }
  .portada img.logo { width: 78mm; }
  .portada .linea { width: 34mm; height: 1.2mm; background: ${MARCA.acento}; margin: 70mm 0 9mm; border-radius: 1mm; }
  .portada h1 { font-family: Georgia, "Times New Roman", serif; font-weight: 600; font-size: 34pt; line-height: 1.1; margin: 0 0 5mm; }
  .portada .sub { font-size: 15pt; color: ${MARCA.acento}; margin: 0 0 3mm; }
  .portada .pub { font-size: 11pt; opacity: .85; margin: 0; }
  .portada .pie { margin-top: auto; font-size: 9.5pt; opacity: .75; display: flex; justify-content: space-between; border-top: 1px solid rgba(255,255,255,.25); padding-top: 4mm; }
  .indice { page-break-after: always; }
  .indice h2 { font-family: Georgia, serif; color: ${MARCA.primario}; font-size: 20pt; margin: 0 0 6mm; border-bottom: 2px solid ${MARCA.acento}; padding-bottom: 2mm; }
  .indice ol { list-style: none; padding: 0; margin: 0; }
  .indice li { display: flex; align-items: baseline; gap: 2mm; padding: 1.1mm 0; }
  .indice li.n2 { font-weight: 600; margin-top: 2.2mm; color: ${MARCA.primario}; }
  .indice li.n3 { padding-left: 7mm; font-size: 9.6pt; color: #3c4a52; }
  .indice .puntos { flex: 1; border-bottom: 1px dotted #9aa7ad; transform: translateY(-1mm); }
  .indice a { color: inherit; text-decoration: none; }
  .indice .pag { min-width: 7mm; text-align: right; font-variant-numeric: tabular-nums; }
  .manual h1 { display: none; }
  .manual h2 { position: relative; font-family: Georgia, serif; color: ${MARCA.primario}; font-size: 18pt; font-weight: 600; margin: 0 0 4mm; padding-bottom: 2mm; border-bottom: 2px solid ${MARCA.acento}; page-break-before: always; page-break-after: avoid; }
  .manual h3 { position: relative; color: ${MARCA.primario}; font-size: 12.5pt; margin: 6mm 0 2mm; page-break-after: avoid; }
  .manual h4 { position: relative; font-size: 11pt; margin: 4mm 0 1.5mm; page-break-after: avoid; }
  .marcador { position: absolute; left: 0; top: 0; font-size: 1px; color: #fff; }
  .manual p, .manual ul, .manual ol { margin: 0 0 2.6mm; }
  .manual ul, .manual ol { padding-left: 6mm; }
  .manual li { margin: 0.8mm 0; }
  .manual li::marker { color: ${MARCA.primario}; font-weight: 700; }
  .manual a { color: ${MARCA.primario}; }
  .manual code { font-family: Consolas, "Courier New", monospace; font-size: 9pt; background: #eef2f3; border-radius: 1mm; padding: .2mm 1mm; }
  .manual pre { background: #0f2a31; color: #e8f0f2; border-radius: 2mm; padding: 3mm 4mm; font-size: 8.6pt; white-space: pre-wrap; page-break-inside: avoid; }
  .manual pre code { background: none; color: inherit; padding: 0; }
  .manual .para-que { background: ${MARCA.crema}; border-left: 1.2mm solid ${MARCA.acento}; padding: 2.4mm 3.5mm; border-radius: 0 2mm 2mm 0; }
  .manual figure { margin: 2mm 0 4mm; page-break-inside: avoid; text-align: center; }
  .manual figure img { max-width: 100%; max-height: ${movil ? "150mm" : "98mm"}; border: 1px solid #d5dde0; border-radius: 2mm; box-shadow: 0 0.6mm 2mm rgba(0,0,0,.08); }
  .manual figure.movil img { width: 62mm; max-height: 135mm; object-fit: contain; object-position: top; border-radius: 4mm; }
  .manual figcaption { font-size: 8.8pt; color: #5c6b72; margin-top: 1.5mm; font-style: italic; }
  .manual .cuadro { border-radius: 2mm; padding: 2.6mm 3.6mm; margin: 0 0 3mm; page-break-inside: avoid; border: 1px solid; }
  .manual .cuadro > :last-child { margin-bottom: 0; }
  .manual .cuadro.consejo { background: #eef7f1; border-color: #b7dcc4; }
  .manual .cuadro.importante { background: #fdf4e3; border-color: #ebcf95; }
  .manual .cuadro.nota { background: #edf3f7; border-color: #bfd3df; }
  .manual .tabla { page-break-inside: avoid; margin: 0 0 3mm; }
  ${movil ? `
  /* Guías del estudiante: dos columnas y capturas del celular pequeñas (4–6 páginas). */
  main.manual { column-count: 2; column-gap: 9mm; column-fill: auto; }
  .manual h2 { break-before: auto; page-break-before: auto; font-size: 14pt; margin-top: 5mm; break-after: avoid; }
  .manual h2:first-child { margin-top: 0; }
  .manual figure.movil { margin: 1.5mm 0 3mm; break-inside: avoid; }
  .manual figure.movil img { width: 40mm; max-height: 87mm; border-radius: 3mm; }
  .manual .cuadro, .manual .para-que { break-inside: avoid; }
  body { font-size: 9.8pt; }
  .indice { page-break-after: auto; margin-bottom: 6mm; }
  .indice ol { column-count: 2; column-gap: 9mm; }
  .indice li.n2 { margin-top: 0; }` : ""}
  .manual table { width: 100%; border-collapse: collapse; font-size: 9.4pt; }
  .manual th { background: ${MARCA.primario}; color: #fff; text-align: left; padding: 1.6mm 2.2mm; }
  .manual td { border-bottom: 1px solid #dde4e7; padding: 1.6mm 2.2mm; vertical-align: top; }
  .manual tr:nth-child(even) td { background: #f7f9fa; }
  `;
}

function html(def: Def, paginas: Map<string, number> | null, conMarcadores: boolean) {
  const md = readFileSync(join(CARPETA, def.md), "utf8");
  const desde = md.search(/^##\s/m);
  const intro = md.slice(0, desde).replace(/^#\s.*$/m, "").replace(/<!--[\s\S]*?-->/g, "").trim();
  const { html: cuerpo, titulos } = renderizarMarkdown(md.slice(desde), { imagen: (src) => pathToFileURL(join(CARPETA, src)).href });
  // Marcador invisible al inicio de cada título: permite ubicar su página en el PDF.
  const conMarca = conMarcadores ? cuerpo.replace(/<h([234]) id="([^"]+)">/g, (_m, n, id) => `<h${n} id="${id}"><span class="marcador">@@${id}@@</span>`) : cuerpo;
  const entradas = titulos.filter((t: Titulo) => def.niveles.includes(t.nivel));
  const indice = entradas
    .map((t) => `<li class="n${t.nivel}"><a href="#${escaparHtml(t.id)}">${escaparHtml(t.texto)}</a><span class="puntos"></span><span class="pag">${paginas?.get(t.id) ?? "00"}</span></li>`)
    .join("");
  const logo = pathToFileURL(resolve("public/brand/logo-blanco.svg")).href;
  const tIndice = def.idioma === "pt" ? "Conteúdo" : "Índice";
  const introHtml = intro ? renderizarMarkdown(intro).html : "";
  return `<!doctype html><html lang="${def.idioma}"><head><meta charset="utf-8"><title>${escaparHtml(def.titulo)}</title><style>${estilos(def.movil)}</style></head><body>
  <section class="portada"><div class="mancha1"></div><div class="mancha2"></div><div class="contenido">
    <img class="logo" src="${logo}" alt="Julieta Ponz">
    <div class="linea"></div>
    <h1>${escaparHtml(def.titulo)}</h1>
    <p class="sub">${escaparHtml(def.subtitulo)}</p>
    <p class="pub">${escaparHtml(def.publico)}</p>
    <div class="pie"><span>julietaponz.com</span><span>${escaparHtml(fechaVersion(def.idioma))}</span></div>
  </div></section>
  <section class="indice"><h2>${tIndice}</h2><div class="manual">${introHtml}</div><ol>${indice}</ol></section>
  <main class="manual">${conMarca}</main></body></html>`;
}

const pie = (def: Def) =>
  `<div style="width:100%;font-family:Segoe UI,Arial,sans-serif;font-size:8px;color:#7a888e;padding:0 17mm;display:flex;justify-content:space-between"><span>${escaparHtml(def.titulo)} · julietaponz.com</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`;

async function imprimir(page: Page, def: Def, contenido: string) {
  // Desde un archivo local: así el navegador puede cargar las capturas (file://).
  const tmp = resolve(`.data/manual-pdf/${def.pdf.replace(".pdf", ".html")}`);
  mkdirSync(dirname(tmp), { recursive: true });
  writeFileSync(tmp, contenido.replaceAll(' loading="lazy"', ""));
  await page.goto(pathToFileURL(tmp).href, { waitUntil: "load" });
  await page.waitForFunction(() => Array.from(document.images).every((i) => i.complete), null, { timeout: 60_000 });
  return page.pdf({ format: "A4", printBackground: true, displayHeaderFooter: true, headerTemplate: "<div></div>", footerTemplate: pie(def), preferCSSPageSize: true });
}

async function paginasDeTitulos(pdf: Buffer) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(pdf), useSystemFonts: true }).promise;
  const mapa = new Map<string, number>();
  for (let n = 1; n <= doc.numPages; n++) {
    const texto = (await (await doc.getPage(n)).getTextContent()).items.map((x) => ("str" in x ? x.str : "")).join("");
    for (const m of texto.matchAll(/@@([\w-]+)@@/g)) if (!mapa.has(m[1])) mapa.set(m[1], n);
  }
  return { mapa, total: doc.numPages };
}

async function main() {
  const nav = await chromium.launch();
  const page = await nav.newPage();
  for (const def of MANUALES) {
    const primera = await imprimir(page, def, html(def, null, true));
    const { mapa } = await paginasDeTitulos(primera);
    const final = await imprimir(page, def, html(def, mapa, false));
    const ruta = join(CARPETA, def.pdf);
    writeFileSync(ruta, final);
    const { total } = await paginasDeTitulos(final);
    console.log(`✓ docs/manual/${def.pdf} (${total} páginas, ${(final.length / 1024 / 1024).toFixed(1)} MB)`);
  }
  await nav.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
