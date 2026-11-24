"use client";
import { Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { EstadoVacio } from "@/components/ui/varios";
import { cn } from "@/lib/utils";

type Seccion = { id: string; titulo: string; html: string; texto: string; subtitulos: { id: string; texto: string }[] };

const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Fragmento del texto alrededor de la primera coincidencia (para mostrar en los resultados). */
function fragmento(texto: string, q: string) {
  const i = normalizar(texto).indexOf(q);
  if (i < 0) return "";
  const desde = Math.max(0, i - 60);
  return `${desde > 0 ? "…" : ""}${texto.slice(desde, i + q.length + 90)}…`;
}

/** Manual de la Dra.: índice lateral, buscador (sin tildes ni mayúsculas) y secciones con anclas (#id). */
export function ManualNavegable({ secciones }: { secciones: Seccion[] }) {
  const [q, setQ] = useState("");
  const [activa, setActiva] = useState(secciones[0]?.id ?? "");
  const contenido = useRef<HTMLDivElement>(null);
  const qn = normalizar(q.trim());
  const visibles = useMemo(() => (qn.length < 2 ? secciones : secciones.filter((s) => normalizar(s.texto).includes(qn))), [qn, secciones]);

  // Resalta la sección visible en el índice.
  useEffect(() => {
    const raiz = contenido.current;
    if (!raiz) return;
    const obs = new IntersectionObserver(
      (entradas) => {
        const vis = entradas.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (vis) setActiva(vis.target.id.replace(/^sec-/, ""));
      },
      { rootMargin: "-80px 0px -70% 0px" },
    );
    raiz.querySelectorAll("section[id^='sec-']").forEach((s) => obs.observe(s));
    return () => obs.disconnect();
  }, [visibles]);

  // Al llegar con un ancla (#seccion) desde el botón "?" de otra pantalla, va directo a ella.
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (id) document.getElementById(id)?.scrollIntoView();
  }, []);

  // Resalta la búsqueda dentro del texto visible.
  useEffect(() => {
    const raiz = contenido.current;
    if (!raiz) return;
    raiz.querySelectorAll("mark[data-busqueda]").forEach((m) => m.replaceWith(document.createTextNode(m.textContent ?? "")));
    raiz.normalize();
    if (qn.length < 2) return;
    const caminante = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
    const nodos: Text[] = [];
    while (caminante.nextNode()) nodos.push(caminante.currentNode as Text);
    for (const n of nodos) {
      const t = n.textContent ?? "";
      const i = normalizar(t).indexOf(qn);
      if (i < 0) continue;
      const despues = n.splitText(i);
      despues.splitText(qn.length);
      const m = document.createElement("mark");
      m.dataset.busqueda = "1";
      m.textContent = despues.textContent;
      despues.replaceWith(m);
    }
  }, [qn, visibles]);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="space-y-4 lg:sticky lg:top-24">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground" aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar en el manual…"
            aria-label="Buscar en el manual"
            className="h-10 w-full rounded-lg border border-border-strong bg-surface pl-9 pr-9 text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15"
          />
          {q && (
            <button type="button" onClick={() => setQ("")} aria-label="Borrar búsqueda" className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-subtle-foreground hover:text-foreground">
              <X className="size-4" />
            </button>
          )}
        </div>
        <nav aria-label="Temas del manual" className="max-h-[calc(100vh-12rem)] overflow-y-auto rounded-xl border border-border bg-surface p-2 shadow-xs">
          {qn.length >= 2 && <p className="px-2 pb-2 pt-1 text-xs text-muted-foreground">{visibles.length ? `${visibles.length} ${visibles.length === 1 ? "tema" : "temas"} con «${q.trim()}»` : "Sin resultados"}</p>}
          <ul className="space-y-0.5 text-sm">
            {visibles.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className={cn("block rounded-md px-2.5 py-1.5 leading-snug hover:bg-muted", activa === s.id ? "bg-primary-soft font-medium text-primary" : "text-muted-foreground")}>
                  {s.titulo}
                </a>
                {qn.length >= 2 && <p className="line-clamp-2 px-2.5 pb-1 text-[11px] text-subtle-foreground">{fragmento(s.texto, qn)}</p>}
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      <div ref={contenido} className="min-w-0 space-y-6">
        {visibles.length === 0 ? (
          <Card>
            <EstadoVacio icono={Search} titulo="No encontramos esa palabra" descripcion="Prueba con otra, por ejemplo «cuota», «comprobante», «enlace» o «mora». También puedes revisar las Preguntas frecuentes." />
          </Card>
        ) : (
          visibles.map((s) => (
            <section key={s.id} id={`sec-${s.id}`} className="rounded-xl border border-border bg-surface p-5 shadow-xs sm:p-7">
              <div className="manual" dangerouslySetInnerHTML={{ __html: s.html }} />
            </section>
          ))
        )}
      </div>
    </div>
  );
}
