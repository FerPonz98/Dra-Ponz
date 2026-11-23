"use client";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, Search } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Input, Select } from "./input";
import { MenuAcciones } from "./menu";

export type ColumnaTabla = { id: string; titulo: string; ordenable?: boolean; alinear?: "derecha"; ocultarEnMovil?: boolean; clase?: string };
export type FilaTabla = {
  id: string;
  /** Contenido renderizado de cada columna. */
  celdas: Record<string, React.ReactNode>;
  /** Valores para ordenar. */
  orden?: Record<string, string | number>;
  /** Texto donde busca el buscador. */
  busqueda: string;
  /** Valor para el filtro. */
  filtro?: string;
  href?: string;
  acciones?: { etiqueta: string; href: string }[];
  /** Título y subtítulo de la tarjeta en el celular (si no, se usa la primera columna). */
  titulo?: React.ReactNode;
};

/**
 * Tabla profesional: búsqueda, filtro, orden, paginación, encabezado fijo y menú de acciones.
 * En el celular cada fila se muestra como tarjeta.
 */
export function TablaDatos({
  columnas,
  filas,
  buscar = "Buscar…",
  filtro,
  porPagina = 15,
  vacio,
  etiqueta,
  busquedaInicial = "",
}: {
  columnas: ColumnaTabla[];
  filas: FilaTabla[];
  buscar?: string;
  filtro?: { etiqueta: string; opciones: { valor: string; etiqueta: string }[] };
  porPagina?: number;
  vacio?: React.ReactNode;
  etiqueta: string;
  busquedaInicial?: string;
}) {
  const [q, setQ] = React.useState(busquedaInicial);
  const [f, setF] = React.useState("");
  const [orden, setOrden] = React.useState<{ col: string; dir: 1 | -1 } | null>(null);
  const [pagina, setPagina] = React.useState(0);

  const visibles = React.useMemo(() => {
    const t = q.trim().toLowerCase();
    let r = filas.filter((x) => (!t || x.busqueda.toLowerCase().includes(t)) && (!f || x.filtro === f));
    if (orden) {
      r = [...r].sort((a, b) => {
        const va = a.orden?.[orden.col] ?? "";
        const vb = b.orden?.[orden.col] ?? "";
        return (typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "es")) * orden.dir;
      });
    }
    return r;
  }, [filas, q, f, orden]);

  const paginas = Math.max(1, Math.ceil(visibles.length / porPagina));
  const pag = Math.min(pagina, paginas - 1);
  const actuales = visibles.slice(pag * porPagina, pag * porPagina + porPagina);
  const conAcciones = filas.some((x) => x.acciones?.length);

  if (!filas.length && vacio) return <>{vacio}</>;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-xs">
      <div className="flex flex-col gap-2 border-b border-border p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground" aria-hidden />
          <Input
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPagina(0);
            }}
            placeholder={buscar}
            aria-label={buscar}
            className="pl-9"
          />
        </div>
        {filtro && (
          <Select
            aria-label={filtro.etiqueta}
            value={f}
            onChange={(e) => {
              setF(e.target.value);
              setPagina(0);
            }}
            className="sm:w-52"
          >
            <option value="">{filtro.etiqueta}: todos</option>
            {filtro.opciones.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.etiqueta}
              </option>
            ))}
          </Select>
        )}
      </div>

      {actuales.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-muted-foreground">No hay resultados para tu búsqueda.</p>
      ) : (
        <>
          {/* Escritorio: tabla */}
          <div className="hidden max-h-[70vh] overflow-auto md:block">
            <table className="w-full border-separate border-spacing-0 text-sm" aria-label={etiqueta}>
              <thead className="sticky top-0 z-10 bg-surface-2">
                <tr>
                  {columnas.map((c) => {
                    const activo = orden?.col === c.id;
                    return (
                      <th
                        key={c.id}
                        scope="col"
                        aria-sort={activo ? (orden!.dir === 1 ? "ascending" : "descending") : undefined}
                        className={cn("h-10 border-b border-border px-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground first:pl-5", c.alinear === "derecha" && "text-right", c.clase)}
                      >
                        {c.ordenable ? (
                          <button
                            type="button"
                            className={cn("inline-flex items-center gap-1 uppercase hover:text-foreground", c.alinear === "derecha" && "flex-row-reverse")}
                            onClick={() => setOrden((o) => (o?.col === c.id ? { col: c.id, dir: o.dir === 1 ? -1 : 1 } : { col: c.id, dir: 1 }))}
                          >
                            {c.titulo}
                            {activo ? orden!.dir === 1 ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" /> : <ChevronsUpDown className="size-3.5 opacity-50" />}
                          </button>
                        ) : (
                          c.titulo
                        )}
                      </th>
                    );
                  })}
                  {conAcciones && (
                    <th className="w-12 border-b border-border pr-5">
                      <span className="sr-only">Acciones</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {actuales.map((x) => (
                  <tr key={x.id} className="group transition-colors hover:bg-surface-2/70">
                    {columnas.map((c) => (
                      <td key={c.id} className={cn("border-b border-border px-3 py-3 align-middle first:pl-5 group-last:border-0", c.alinear === "derecha" && "text-right tabular-nums", c.clase)}>
                        {x.celdas[c.id]}
                      </td>
                    ))}
                    {conAcciones && (
                      <td className="border-b border-border pr-4 text-right group-last:border-0">
                        <MenuAcciones acciones={x.acciones ?? []} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Celular: tarjetas */}
          <ul className="divide-y divide-border md:hidden" aria-label={etiqueta}>
            {actuales.map((x) => (
              <li key={x.id} className="relative flex items-start gap-3 px-4 py-3.5">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="font-medium">{x.titulo ?? x.celdas[columnas[0].id]}</div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                    {columnas.slice(1).map((c) =>
                      c.ocultarEnMovil ? null : (
                        <div key={c.id} className="min-w-0">
                          <dt className="text-[11px] font-medium uppercase tracking-wide text-subtle-foreground">{c.titulo}</dt>
                          <dd className="truncate">{x.celdas[c.id]}</dd>
                        </div>
                      ),
                    )}
                  </dl>
                </div>
                {x.acciones?.length ? <MenuAcciones acciones={x.acciones} /> : x.href ? <Link href={x.href} className="sr-only">Abrir</Link> : null}
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
        <span>
          {visibles.length} {visibles.length === 1 ? "resultado" : "resultados"}
        </span>
        {paginas > 1 && (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" aria-label="Página anterior" disabled={pag === 0} onClick={() => setPagina(pag - 1)}>
              <ChevronLeft />
            </Button>
            <span className="tabular-nums">
              {pag + 1} / {paginas}
            </span>
            <Button variant="ghost" size="icon-sm" aria-label="Página siguiente" disabled={pag >= paginas - 1} onClick={() => setPagina(pag + 1)}>
              <ChevronRight />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
