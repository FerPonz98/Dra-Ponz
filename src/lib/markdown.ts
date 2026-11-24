// Markdown mínimo y seguro para los manuales (docs/manual/*.md): lo usan la ayuda dentro del sistema
// (/panel/ayuda, /ayuda/estudiante) y el generador de PDF (npm run manual:pdf).
// Soporta: títulos (# … ####, con {#id} opcional), párrafos, **negrita**, *cursiva*, `código`, enlaces, imágenes
// (en su propia línea → figura con pie tomado del "título"), listas numeradas (respeta el número inicial) y con
// viñetas (con contenido sangrado: imágenes, párrafos), citas, cuadros «Consejo» / «Importante» / «Nota»,
// tablas, líneas horizontales y bloques de código. Todo el texto se escapa: no admite HTML crudo.

export type Titulo = { nivel: number; texto: string; id: string };
export type OpcionesMd = {
  /** Reescribe la ruta de cada imagen (p. ej. "img/x.png" → "/ayuda/img/x.png"). */
  imagen?: (src: string) => string;
  /** Prefijo para los id de los títulos (evita choques si se renderizan varios documentos en una página). */
  prefijoId?: string;
};
export type ResultadoMd = { html: string; titulos: Titulo[] };

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escaparHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ESCAPES[c]);

/** "¿Qué es la mora?" → "que-es-la-mora" */
export function slug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Texto plano de una línea con formato inline (para búsquedas e índices). */
export function textoPlano(md: string): string {
  return md
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function urlSegura(url: string): string {
  const u = url.trim();
  if (/^(https?:|mailto:|#|\/|\.{0,2}\/?[\w-])/i.test(u) && !/^(javascript|data|vbscript):/i.test(u)) return u;
  return "#";
}

function enLinea(md: string, o: OpcionesMd): string {
  // Se separan los fragmentos de código para no aplicar formato dentro de ellos.
  return md
    .split(/(`[^`]+`)/g)
    .map((parte) => {
      if (/^`[^`]+`$/.test(parte)) return `<code>${escaparHtml(parte.slice(1, -1))}</code>`;
      let s = escaparHtml(parte);
      s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g, (_m, alt: string, src: string) => {
        const ruta = o.imagen ? o.imagen(src) : src;
        return `<img src="${escaparHtml(urlSegura(ruta))}" alt="${alt}" loading="lazy">`;
      });
      s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, t: string, href: string) => {
        const h = urlSegura(href.replace(/&amp;/g, "&"));
        const ext = /^https?:/i.test(h);
        const destino = h.startsWith("#") && o.prefijoId ? `#${o.prefijoId}${h.slice(1)}` : h;
        return `<a href="${escaparHtml(destino)}"${ext ? ' target="_blank" rel="noopener noreferrer"' : ""}>${t}</a>`;
      });
      s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
      s = s.replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, "$1<em>$2</em>");
      return s;
    })
    .join("");
}

const RE_LISTA = /^(\s*)(\d+)\.\s+(.*)$|^(\s*)[-*]\s+(.*)$/;
const RE_IMAGEN_SOLA = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)\s*$/;

function tablaHtml(lineas: string[], o: OpcionesMd): string {
  const celdas = (l: string) =>
    l
      .trim()
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((c) => c.trim());
  const cab = celdas(lineas[0]);
  const filas = lineas.slice(2).map(celdas);
  return `<div class="tabla"><table><thead><tr>${cab.map((c) => `<th>${enLinea(c, o)}</th>`).join("")}</tr></thead><tbody>${filas
    .map((f) => `<tr>${f.map((c) => `<td>${enLinea(c, o)}</td>`).join("")}</tr>`)
    .join("")}</tbody></table></div>`;
}

function bloques(lineas: string[], o: OpcionesMd, titulos: Titulo[], usados: Map<string, number>): string {
  const out: string[] = [];
  let i = 0;
  const parrafo: string[] = [];
  const cerrarParrafo = () => {
    if (!parrafo.length) return;
    const texto = parrafo.join(" ").trim();
    parrafo.length = 0;
    const para = /^\*\*(Para qué sirve|Para que serve):\*\*/i.test(texto);
    out.push(`<p${para ? ' class="para-que"' : ""}>${enLinea(texto, o)}</p>`);
  };

  while (i < lineas.length) {
    const l = lineas[i];
    // Código
    if (/^```/.test(l.trim())) {
      cerrarParrafo();
      const cuerpo: string[] = [];
      i++;
      while (i < lineas.length && !/^```/.test(lineas[i].trim())) cuerpo.push(lineas[i++]);
      i++;
      out.push(`<pre><code>${escaparHtml(cuerpo.join("\n"))}</code></pre>`);
      continue;
    }
    if (!l.trim()) {
      cerrarParrafo();
      i++;
      continue;
    }
    // Comentarios HTML (notas para quien edita el manual): se omiten.
    if (/^<!--/.test(l.trim())) {
      cerrarParrafo();
      while (i < lineas.length && !lineas[i].includes("-->")) i++;
      i++;
      continue;
    }
    // Títulos
    const t = /^(#{1,4})\s+(.*?)(?:\s+\{#([\w-]+)\})?\s*$/.exec(l);
    if (t) {
      cerrarParrafo();
      const nivel = t[1].length;
      const texto = textoPlano(t[2]);
      let id = (o.prefijoId ?? "") + (t[3] ?? slug(texto));
      const n = usados.get(id) ?? 0;
      usados.set(id, n + 1);
      if (n) id = `${id}-${n + 1}`;
      titulos.push({ nivel, texto, id });
      out.push(`<h${nivel} id="${escaparHtml(id)}">${enLinea(t[2], o)}</h${nivel}>`);
      i++;
      continue;
    }
    // Línea horizontal / salto de página (solo PDF)
    if (/^(-{3,}|\*{3,})\s*$/.test(l.trim())) {
      cerrarParrafo();
      out.push("<hr>");
      i++;
      continue;
    }
    // Tabla
    if (/^\s*\|.*\|\s*$/.test(l) && i + 1 < lineas.length && /^\s*\|?\s*:?-{3,}/.test(lineas[i + 1])) {
      cerrarParrafo();
      const t2: string[] = [];
      while (i < lineas.length && /^\s*\|.*\|\s*$/.test(lineas[i])) t2.push(lineas[i++]);
      out.push(tablaHtml(t2, o));
      continue;
    }
    // Cita / cuadro
    if (/^\s*>/.test(l)) {
      cerrarParrafo();
      const c: string[] = [];
      while (i < lineas.length && /^\s*>/.test(lineas[i])) c.push(lineas[i++].replace(/^\s*>\s?/, ""));
      const interior = bloques(c, o, titulos, usados);
      const primera = c.join(" ").trim();
      const tipo = /^\*\*(Consejo|Dica)/i.test(primera) ? "consejo" : /^\*\*(Importante)/i.test(primera) ? "importante" : /^\*\*(Nota)/i.test(primera) ? "nota" : null;
      out.push(tipo ? `<aside class="cuadro ${tipo}">${interior}</aside>` : `<blockquote>${interior}</blockquote>`);
      continue;
    }
    // Imagen sola → figura
    const img = RE_IMAGEN_SOLA.exec(l.trim());
    if (img) {
      cerrarParrafo();
      const ruta = o.imagen ? o.imagen(img[2]) : img[2];
      const movil = /(^|\/)est-|-movil|-celular/.test(img[2]);
      out.push(
        `<figure${movil ? ' class="movil"' : ""}><img src="${escaparHtml(urlSegura(ruta))}" alt="${escaparHtml(img[1])}" loading="lazy">${img[3] ? `<figcaption>${enLinea(img[3], o)}</figcaption>` : ""}</figure>`,
      );
      i++;
      continue;
    }
    // Listas
    const li = RE_LISTA.exec(l);
    if (li && !(li[1] ?? li[4] ?? "").length) {
      cerrarParrafo();
      const ordenada = li[2] !== undefined;
      const inicio = ordenada ? Number(li[2]) : 1;
      const items: string[][] = [];
      while (i < lineas.length) {
        const m = RE_LISTA.exec(lineas[i]);
        const sangria = m ? (m[1] ?? m[4] ?? "").length : 0;
        if (m && sangria === 0 && (m[2] !== undefined) === ordenada) {
          items.push([m[2] !== undefined ? m[3] : m[5]]);
          i++;
          continue;
        }
        // Contenido sangrado (o línea en blanco seguida de contenido sangrado) pertenece al último ítem.
        if (/^\s{2,}\S/.test(lineas[i])) {
          items[items.length - 1].push(lineas[i].replace(/^\s{2,4}/, ""));
          i++;
          continue;
        }
        if (!lineas[i].trim() && i + 1 < lineas.length && /^\s{2,}\S/.test(lineas[i + 1])) {
          items[items.length - 1].push("");
          i++;
          continue;
        }
        break;
      }
      const etiqueta = ordenada ? "ol" : "ul";
      const attr = ordenada && inicio !== 1 ? ` start="${inicio}"` : "";
      out.push(
        `<${etiqueta}${attr}>${items
          .map((it) => {
            const [primera, ...resto] = it;
            const extra = resto.length ? bloques(resto, o, titulos, usados) : "";
            return `<li>${enLinea(primera, o)}${extra}</li>`;
          })
          .join("")}</${etiqueta}>`,
      );
      continue;
    }
    parrafo.push(l.trim());
    i++;
  }
  cerrarParrafo();
  return out.join("\n");
}

/** Convierte Markdown en HTML (escapado) y devuelve también los títulos con su id. */
export function renderizarMarkdown(md: string, o: OpcionesMd = {}): ResultadoMd {
  const titulos: Titulo[] = [];
  const html = bloques(md.replace(/\r\n?/g, "\n").split("\n"), o, titulos, new Map());
  return { html, titulos };
}

export type Seccion = { id: string; titulo: string; html: string; texto: string; subtitulos: Titulo[] };

/**
 * Divide un manual en secciones por título de nivel 2 (## …). Lo que está antes del primer ## (portada, índice)
 * se descarta. Cada sección trae su HTML, sus subtítulos y su texto plano (para el buscador).
 */
export function seccionesMarkdown(md: string, o: OpcionesMd = {}): Seccion[] {
  const lineas = md.replace(/\r\n?/g, "\n").split("\n");
  const grupos: string[][] = [];
  let enCodigo = false;
  for (const l of lineas) {
    if (/^```/.test(l.trim())) enCodigo = !enCodigo;
    if (!enCodigo && /^##\s/.test(l)) grupos.push([]);
    if (grupos.length) grupos[grupos.length - 1].push(l);
  }
  const usados = new Map<string, number>();
  return grupos.map((g) => {
    const titulos: Titulo[] = [];
    const html = bloques(g, o, titulos, usados);
    const principal = titulos[0];
    const texto = textoPlano(g.filter((x) => !/^!\[/.test(x.trim())).join(" "));
    return { id: principal?.id ?? slug(g[0]), titulo: principal?.texto ?? g[0].replace(/^#+\s*/, ""), html, texto, subtitulos: titulos.filter((t) => t.nivel === 3) };
  });
}

/** Valida el nombre de una imagen del manual (evita rutas como ../../.env). */
export function nombreImagenValido(nombre: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,80}\.(png|jpg|webp)$/.test(nombre);
}
