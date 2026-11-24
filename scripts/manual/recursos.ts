// Recursos FICTICIOS para la base de demostración: un QR de muestra (no cobra nada), un comprobante de transferencia
// de ejemplo y un PDF de perfil de investigación. Todos llevan la marca "DEMO". Se generan con el Chromium de Playwright.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

export const CARPETA_RECURSOS = ".data/demo-manual/recursos";

/** Patrón tipo QR determinista (no es un QR válido: no se puede pagar con él). */
function svgQr(lado = 29) {
  let semilla = 7;
  const azar = () => ((semilla = (semilla * 9301 + 49297) % 233280) / 233280);
  const celdas: string[] = [];
  const ojo = (x: number, y: number) => x < 7 && y < 7;
  for (let y = 0; y < lado; y++)
    for (let x = 0; x < lado; x++) {
      if (ojo(x, y) || ojo(lado - 1 - x, y) || ojo(x, lado - 1 - y)) continue;
      if (azar() > 0.52) celdas.push(`<rect x="${x}" y="${y}" width="1" height="1"/>`);
    }
  const marca = (x: number, y: number) => `<rect x="${x}" y="${y}" width="7" height="7"/><rect x="${x + 1}" y="${y + 1}" width="5" height="5" fill="#fff"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 ${lado + 4} ${lado + 4}" width="560" height="560" shape-rendering="crispEdges"><rect x="-2" y="-2" width="${lado + 4}" height="${lado + 4}" fill="#fff"/><g fill="#111">${celdas.join("")}${marca(0, 0)}${marca(lado - 7, 0)}${marca(0, lado - 7)}</g><rect x="${lado / 2 - 5}" y="${lado / 2 - 2}" width="10" height="4" rx="0.6" fill="#fff" stroke="#c2410c" stroke-width="0.3"/><text x="${lado / 2}" y="${lado / 2 + 1.1}" font-family="Arial" font-size="2.6" font-weight="700" text-anchor="middle" fill="#c2410c">DEMO</text></svg>`;
}

const COMPROBANTE = `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;font-family:Arial,sans-serif;background:#eef2f5}
.t{width:420px;margin:0 auto;background:#fff;padding:28px 26px;border-radius:14px}
.b{display:flex;align-items:center;gap:10px;color:#0b5c3b;font-weight:700;font-size:18px}
.c{width:34px;height:34px;border-radius:50%;background:#0b5c3b;color:#fff;display:flex;align-items:center;justify-content:center;font-size:20px}
h1{font-size:15px;color:#333;margin:18px 0 4px} .m{font-size:30px;font-weight:700;margin:4px 0 16px}
.f{display:flex;justify-content:space-between;font-size:13px;color:#555;border-top:1px solid #eee;padding:8px 0}
.f b{color:#222} .d{margin-top:14px;text-align:center;color:#c2410c;font-weight:700;letter-spacing:3px;border:2px dashed #c2410c;padding:6px;border-radius:8px}
</style></head><body><div class="t"><div class="b"><span class="c">✓</span>Banco de Ejemplo</div>
<h1>Transferencia QR exitosa</h1><div class="m">Bs 2.000,00</div>
<div class="f"><span>Fecha</span><b>__FECHA__</b></div><div class="f"><span>Origen</span><b>Cuenta ****4821</b></div>
<div class="f"><span>Destino</span><b>Cuenta de ejemplo ****0000</b></div><div class="f"><span>Glosa</span><b>Cuota asesoría de tesis</b></div>
<div class="f"><span>N.º de operación</span><b>000123456</b></div><div class="d">COMPROBANTE DE DEMOSTRACIÓN</div></div></body></html>`;

const PERFIL = `<!doctype html><html><head><meta charset="utf-8"><style>
body{font-family:Georgia,serif;margin:60px;color:#222} h1{font-size:20px;text-align:center} p{line-height:1.6}
.d{color:#c2410c;text-align:center;font-family:Arial;font-weight:700;letter-spacing:2px}</style></head><body>
<p class="d">DOCUMENTO DE DEMOSTRACIÓN</p><h1>Perfil de investigación</h1>
<p><b>Tema:</b> Calidad del agua de consumo en comunidades rurales de Pando.</p>
<p><b>Problema:</b> texto de ejemplo para mostrar cómo se ven los archivos que sube el estudiante desde su portal.</p>
<p>Objetivo general, objetivos específicos, justificación y metodología (contenido ficticio).</p></body></html>`;

// Foto de ejemplo para la portada: una silueta ilustrada (no es una persona real).
const FOTO = `<!doctype html><html><body style="margin:0"><svg xmlns="http://www.w3.org/2000/svg" width="720" height="900" viewBox="0 0 720 900">
<defs><linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9c9a8"/><stop offset="1" stop-color="#8fa9ad"/></linearGradient></defs>
<rect width="720" height="900" fill="url(#f)"/><circle cx="360" cy="330" r="130" fill="#3b4d52"/>
<path d="M120 900 C140 640 250 540 360 540 C470 540 580 640 600 900 Z" fill="#3b4d52"/>
<rect x="210" y="790" width="300" height="56" rx="28" fill="#fff" opacity=".85"/>
<text x="360" y="827" font-family="Arial" font-size="26" font-weight="700" text-anchor="middle" fill="#c2410c">FOTO DE EJEMPLO</text></svg></body></html>`;

export async function generarRecursos(fecha: string) {
  mkdirSync(CARPETA_RECURSOS, { recursive: true });
  const nav = await chromium.launch();
  const page = await nav.newPage({ viewport: { width: 560, height: 560 } });
  await page.setContent(`<html><body style="margin:0">${svgQr()}</body></html>`);
  await page.screenshot({ path: join(CARPETA_RECURSOS, "qr-demo.png") });
  await page.setViewportSize({ width: 472, height: 470 });
  await page.setContent(COMPROBANTE.replace("__FECHA__", fecha));
  await page.locator(".t").screenshot({ path: join(CARPETA_RECURSOS, "comprobante-demo.png") });
  await page.setViewportSize({ width: 720, height: 900 });
  await page.setContent(FOTO);
  await page.screenshot({ path: join(CARPETA_RECURSOS, "foto-demo.png"), type: "png" });
  await page.setContent(PERFIL);
  await page.pdf({ path: join(CARPETA_RECURSOS, "perfil-demo.pdf"), format: "A4" });
  await nav.close();
}
