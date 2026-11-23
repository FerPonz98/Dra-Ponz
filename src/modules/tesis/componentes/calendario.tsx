"use client";
import FullCalendar, { type DatesSetInfo, type EventClickInfo } from "@fullcalendar/react";
import { useMemo } from "react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import listPlugin from "@fullcalendar/react/list";
import esLocale from "@fullcalendar/react/locales/es";
import classicThemePlugin from "@fullcalendar/react/themes/classic";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import "@fullcalendar/react/skeleton.css";
import "@fullcalendar/react/themes/classic/theme.css";
import "@fullcalendar/react/themes/classic/palette.css";
import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { Badge, type VarianteBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PanelLateral } from "@/components/ui/dialogo";
import { cn } from "@/lib/utils";
import type { EventoCalendario, SituacionCobro } from "@/modules/tesis/servicios/calendario";

const VISTAS = [
  ["dayGridMonth", "Mes"],
  ["timeGridWeek", "Semana"],
  ["listMonth", "Lista"],
] as const;

const SIT: Record<SituacionCobro, { t: string; v: VarianteBadge }> = {
  al_dia: { t: "Al día", v: "exito" },
  por_vencer: { t: "Por vencer", v: "aviso" },
  en_gracia: { t: "En gracia", v: "aviso" },
  en_cola: { t: "En cola", v: "peligro" },
  pagada: { t: "Pagada", v: "secondary" },
};

type Api = { prev(): void; next(): void; today(): void; changeView(v: string): void };
type Seleccion = { titulo: string; inicio: string; fin?: string; url: string; tipo: "actividad" | "cobro"; situacion?: SituacionCobro; color: string };

const fmt = (iso: string) => new Intl.DateTimeFormat("es-BO", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso.slice(0, 10)}T00:00:00Z`));

/** Calendario con barra propia (mes / semana / lista), colores por estado y detalle en panel lateral. */
export function Calendario({ eventos }: { eventos: EventoCalendario[] }) {
  const ref = useRef<{ getApi(): Api } | null>(null);
  const [titulo, setTitulo] = useState("");
  const [vista, setVista] = useState<string>("dayGridMonth");
  const [sel, setSel] = useState<Seleccion | null>(null);
  const api = () => ref.current?.getApi();
  // El fondo por defecto queda transparente: cada evento se dibuja como chip propio (eventContent).
  const eventosChip = useMemo(() => eventos.map((e) => ({ ...e, color: "transparent", textColor: "inherit" })), [eventos]);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-xs" data-testid="calendario">
      <div className="flex flex-col gap-3 border-b border-border p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon-sm" aria-label="Anterior" onClick={() => api()?.prev()}>
            <ChevronLeft />
          </Button>
          <Button variant="outline" size="icon-sm" aria-label="Siguiente" onClick={() => api()?.next()}>
            <ChevronRight />
          </Button>
          <Button variant="outline" size="sm" onClick={() => api()?.today()}>
            Hoy
          </Button>
          <h2 className="ml-2 text-base font-semibold first-letter:uppercase" aria-live="polite">
            {titulo}
          </h2>
        </div>
        <div className="inline-flex rounded-lg border border-border bg-surface-2 p-1" role="group" aria-label="Vista del calendario">
          {VISTAS.map(([v, t]) => (
            <button
              key={v}
              type="button"
              aria-pressed={vista === v}
              onClick={() => {
                api()?.changeView(v);
                setVista(v);
              }}
              className={cn("rounded-md px-3 py-1 text-sm font-medium transition-colors", vista === v ? "bg-surface text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground")}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="calendario-propio p-2 sm:p-3">
        <FullCalendar
          ref={ref as never}
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, classicThemePlugin]}
          locale={esLocale}
          timeZone="America/La_Paz"
          initialView="dayGridMonth"
          headerToolbar={false}
          height="auto"
          dayMaxEvents={3}
          allDaySlot
          events={eventosChip}
          eventContent={(arg: { event: { title: string; extendedProps: Record<string, unknown> } }) => {
            const color = String(arg.event.extendedProps.color ?? "#4338ca");
            return (
              <div className="w-full cursor-pointer truncate rounded-md px-1.5 py-0.5 text-[11.5px] font-medium leading-5 text-foreground transition-opacity hover:opacity-80" style={{ background: `${color}1f`, boxShadow: `inset 3px 0 0 ${color}` }}>
                {arg.event.title}
              </div>
            );
          }}
          datesSet={(a: DatesSetInfo) => {
            setTitulo(a.view.title);
            setVista(a.view.type);
          }}
          eventClick={(info: EventClickInfo) => {
            info.jsEvent.preventDefault();
            const e = info.event;
            setSel({
              titulo: e.title,
              inicio: e.startStr,
              fin: e.endStr || undefined,
              url: e.url,
              tipo: e.extendedProps.tipo as "actividad" | "cobro",
              situacion: e.extendedProps.situacion as SituacionCobro | undefined,
              color: String(e.extendedProps.color ?? "#4338ca"),
            });
          }}
        />
      </div>
      <PanelLateral abierto={!!sel} alCambiar={(v) => !v && setSel(null)} titulo={sel?.tipo === "cobro" ? "Fecha de cobro" : "Actividad del cronograma"}>
        {sel && (
          <div className="space-y-5">
            <div className="flex items-start gap-3">
              <span className="mt-1 size-3 shrink-0 rounded-full" style={{ background: sel.color }} aria-hidden />
              <p className="text-base font-semibold">{sel.titulo}</p>
            </div>
            <dl className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <CalendarDays className="size-4 text-muted-foreground" aria-hidden />
                <dd>{sel.tipo === "actividad" && sel.fin ? `${fmt(sel.inicio)} → ${fmt(new Date(Date.parse(sel.fin) - 86_400_000).toISOString())}` : fmt(sel.inicio)}</dd>
              </div>
              {sel.situacion && (
                <div className="flex items-center gap-2">
                  <dt className="text-muted-foreground">Estado:</dt>
                  <dd>
                    <Badge variant={SIT[sel.situacion].v}>{SIT[sel.situacion].t}</Badge>
                  </dd>
                </div>
              )}
            </dl>
            <Button asChild className="w-full">
              <Link href={sel.url}>
                Abrir el proyecto <ArrowRight />
              </Link>
            </Button>
          </div>
        )}
      </PanelLateral>
    </div>
  );
}
