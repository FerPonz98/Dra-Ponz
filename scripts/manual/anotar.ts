// Capturas anotadas para el manual: recuadros numerados y flechas que marcan dónde hacer clic.
// Las marcas se dibujan como una capa HTML encima de la página (position: fixed), se toma la captura y se quitan.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Locator, Page } from "@playwright/test";
import sharp from "sharp";

export const CARPETA_IMG = "docs/manual/img";
const COLOR = "#E4572E"; // naranja de señalización (contrasta con la marca y con el panel)

export type Marca = {
  loc: Locator;
  /** Número del paso (círculo). Sin número = solo recuadro. */
  n?: number;
  /** Texto corto junto a la flecha (p. ej. "Haz clic aquí"). */
  texto?: string;
  /** Dirección desde donde llega la flecha. Por defecto, sin flecha. */
  flecha?: "izq" | "der" | "arriba" | "abajo";
  /** Margen alrededor del elemento (px). */
  margen?: number;
};

type Caja = { x: number; y: number; width: number; height: number };

async function dibujar(page: Page, cajas: (Caja & Omit<Marca, "loc">)[]) {
  await page.evaluate(
    ({ cajas, color }) => {
      document.getElementById("__anotaciones")?.remove();
      const capa = document.createElement("div");
      capa.id = "__anotaciones";
      capa.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:2147483647;font-family:Inter,Arial,sans-serif";
      const svgNS = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(svgNS, "svg");
      svg.setAttribute("width", String(innerWidth));
      svg.setAttribute("height", String(innerHeight));
      svg.style.cssText = "position:absolute;inset:0;overflow:visible";
      svg.innerHTML = `<defs><marker id="punta" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${color}"/></marker></defs>`;
      capa.appendChild(svg);
      const movil = innerWidth < 500;
      for (const c of cajas) {
        // En el celular la pantalla es angosta: solo recuadro y número (las flechas taparían el contenido).
        if (movil) {
          c.flecha = undefined;
          c.texto = undefined;
        }
        const m = c.margen ?? 5;
        const x = c.x - m,
          y = c.y - m,
          w = c.width + 2 * m,
          h = c.height + 2 * m;
        const caja = document.createElement("div");
        caja.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;border:3px solid ${color};border-radius:10px;box-shadow:0 0 0 3px rgba(255,255,255,.85),0 0 0 9999px rgba(15,23,42,0)`;
        capa.appendChild(caja);
        if (c.n !== undefined) {
          const b = document.createElement("div");
          // A la izquierda del recuadro, centrado (no tapa la etiqueta del campo); si no hay lugar, en la esquina.
          const izquierda = x >= 38;
          const bx = izquierda ? x - 34 : Math.max(2, Math.min(innerWidth - 30, x + w - 16));
          const by = izquierda ? Math.max(2, Math.min(innerHeight - 30, y + h / 2 - 14)) : Math.max(2, Math.min(innerHeight - 30, y - 14));
          b.textContent = String(c.n);
          b.style.cssText = `position:absolute;left:${bx}px;top:${by}px;width:28px;height:28px;border-radius:50%;background:${color};color:#fff;font-weight:800;font-size:15px;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 3px #fff,0 2px 6px rgba(0,0,0,.35)`;
          capa.appendChild(b);
        }
        if (c.flecha) {
          const L = 70;
          const cx = x + w / 2,
            cy = y + h / 2;
          let x1 = 0,
            y1 = 0,
            x2 = 0,
            y2 = 0;
          if (c.flecha === "izq") [x1, y1, x2, y2] = [x - L, cy, x - 6, cy];
          if (c.flecha === "der") [x1, y1, x2, y2] = [x + w + L, cy, x + w + 6, cy];
          if (c.flecha === "arriba") [x1, y1, x2, y2] = [cx, y - L, cx, y - 6];
          if (c.flecha === "abajo") [x1, y1, x2, y2] = [cx, y + h + L, cx, y + h + 6];
          const linea = document.createElementNS(svgNS, "line");
          for (const [k, v] of Object.entries({ x1, y1, x2, y2 })) linea.setAttribute(k, String(v));
          linea.setAttribute("stroke", color);
          linea.setAttribute("stroke-width", "5");
          linea.setAttribute("stroke-linecap", "round");
          linea.setAttribute("marker-end", "url(#punta)");
          svg.appendChild(linea);
          if (c.texto) {
            const t = document.createElement("div");
            t.textContent = c.texto;
            t.style.cssText = `position:absolute;white-space:nowrap;background:${color};color:#fff;font-weight:700;font-size:14px;padding:5px 10px;border-radius:999px;box-shadow:0 2px 6px rgba(0,0,0,.3)`;
            capa.appendChild(t);
            const r = t.getBoundingClientRect();
            let tx = x1 - r.width / 2,
              ty = y1 - r.height / 2;
            if (c.flecha === "izq") tx = x1 - r.width - 4;
            if (c.flecha === "der") tx = x1 + 4;
            if (c.flecha === "arriba") ty = y1 - r.height - 2;
            if (c.flecha === "abajo") ty = y1 + 2;
            t.style.left = `${Math.max(4, Math.min(innerWidth - r.width - 4, tx))}px`;
            t.style.top = `${Math.max(4, Math.min(innerHeight - r.height - 4, ty))}px`;
          }
        } else if (c.texto) {
          const t = document.createElement("div");
          t.textContent = c.texto;
          t.style.cssText = `position:absolute;left:${x + w + 8}px;top:${y}px;white-space:nowrap;background:${color};color:#fff;font-weight:700;font-size:13px;padding:4px 9px;border-radius:999px`;
          capa.appendChild(t);
        }
      }
      document.body.appendChild(capa);
    },
    { cajas, color: COLOR },
  );
}

export type OpcionesCaptura = {
  /** Recorta la imagen a la zona de este elemento (más un margen). */
  recorte?: Locator;
  margenRecorte?: number;
  /** Página completa (sin marcas fijas: solo para vistas generales). */
  completa?: boolean;
  /** No mover el scroll antes de capturar. */
  sinScroll?: boolean;
};

let carpetaCreada = false;
export const capturasHechas: string[] = [];

/** Toma una captura (con marcas) y la guarda optimizada en docs/manual/img/<nombre>.png. */
export async function captura(page: Page, nombre: string, marcas: Marca[] = [], o: OpcionesCaptura = {}) {
  if (!carpetaCreada) {
    mkdirSync(CARPETA_IMG, { recursive: true });
    carpetaCreada = true;
  }
  const primero = o.recorte ?? marcas[0]?.loc;
  if (primero && !o.sinScroll) {
    await primero.first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);
  }
  // Centra lo marcado si quedó pegado al borde (barras fijas de arriba/abajo lo tapan).
  if (primero && !o.sinScroll && !o.recorte) {
    const c = await primero.first().boundingBox();
    const alto = page.viewportSize()!.height;
    if (c && (c.y < 90 || c.y + c.height > alto - 90)) {
      await page.evaluate((dy) => window.scrollBy(0, dy), c.y - alto / 3);
      await page.waitForTimeout(250);
    }
  }
  const cajas = [];
  for (const m of marcas) {
    const caja = await m.loc.first().boundingBox();
    if (!caja) throw new Error(`[${nombre}] no se ve el elemento marcado: ${m.loc}`);
    cajas.push({ ...caja, n: m.n, texto: m.texto, flecha: m.flecha, margen: m.margen });
  }
  if (cajas.length) await dibujar(page, cajas);
  let clip: Caja | undefined;
  if (o.recorte) {
    const r = await o.recorte.first().boundingBox();
    if (!r) throw new Error(`[${nombre}] no se ve la zona de recorte`);
    const mg = o.margenRecorte ?? 16;
    const v = page.viewportSize()!;
    const x = Math.max(0, r.x - mg),
      y = Math.max(0, r.y - mg);
    clip = { x, y, width: Math.min(v.width - x, r.width + 2 * mg), height: Math.min(v.height - y, r.height + 2 * mg) };
  }
  const buf = await page.screenshot({ fullPage: !!o.completa, clip, animations: "disabled", caret: "hide" });
  await page.evaluate(() => document.getElementById("__anotaciones")?.remove());
  const ruta = join(CARPETA_IMG, `${nombre}.png`);
  await sharp(buf).png({ compressionLevel: 9, palette: true, quality: 92, effort: 8 }).toFile(ruta);
  capturasHechas.push(nombre);
  console.log(`  ✓ ${nombre}.png`);
}
