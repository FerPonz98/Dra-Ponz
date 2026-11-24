import { CircleHelp, type LucideIcon } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { cn } from "@/lib/utils";

/** Estado vacío con ilustración simple (ícono sobre formas suaves) y una acción. */
export function EstadoVacio({ icono: Icono, titulo, descripcion, accion, className }: { icono: LucideIcon; titulo: string; descripcion?: string; accion?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      <div className="relative mb-5">
        <div aria-hidden className="absolute -inset-3 rounded-full bg-primary-soft/70 blur-sm" />
        <div aria-hidden className="absolute -right-3 -top-1 size-4 rounded-full bg-aviso-soft ring-1 ring-aviso/20" />
        <div aria-hidden className="absolute -bottom-1 -left-3 size-3 rounded-full bg-exito-soft ring-1 ring-exito/20" />
        <div className="relative flex size-14 items-center justify-center rounded-2xl border border-border bg-surface shadow-sm">
          <Icono className="size-6 text-primary" aria-hidden />
        </div>
      </div>
      <p className="text-base font-semibold">{titulo}</p>
      {descripcion && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{descripcion}</p>}
      {accion && <div className="mt-5">{accion}</div>}
    </div>
  );
}

export function Esqueleto({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-shimmer rounded-md bg-[linear-gradient(90deg,var(--muted)_0%,var(--surface-2)_50%,var(--muted)_100%)] bg-[length:200%_100%]", className)} />;
}

const COLORES_AVATAR = [
  "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200",
  "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200",
  "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
  "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200",
];

export function Avatar({ nombre, className }: { nombre: string; className?: string }) {
  const partes = nombre.trim().split(/\s+/);
  const iniciales = ((partes[0]?.[0] ?? "") + (partes.length > 1 ? (partes[partes.length - 1][0] ?? "") : "")).toUpperCase();
  let h = 0;
  for (const c of nombre) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return (
    <span aria-hidden className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold", COLORES_AVATAR[h % COLORES_AVATAR.length], className)}>
      {iniciales || "?"}
    </span>
  );
}

export function BarraProgreso({ valor, etiqueta, className }: { valor: number; etiqueta: string; className?: string }) {
  const v = Math.max(0, Math.min(100, valor));
  return (
    <div role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={etiqueta} className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${v}%` }} />
    </div>
  );
}

export function AnilloProgreso({ valor, tamano = 64, etiqueta }: { valor: number; tamano?: number; etiqueta: string }) {
  const v = Math.max(0, Math.min(100, valor));
  const r = (tamano - 8) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative inline-flex shrink-0" style={{ width: tamano, height: tamano }} role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={etiqueta}>
      <svg width={tamano} height={tamano} className="-rotate-90" aria-hidden>
        <circle cx={tamano / 2} cy={tamano / 2} r={r} fill="none" strokeWidth={6} className="stroke-muted" />
        <circle cx={tamano / 2} cy={tamano / 2} r={r} fill="none" strokeWidth={6} strokeLinecap="round" className="stroke-primary transition-[stroke-dashoffset] duration-700" strokeDasharray={c} strokeDashoffset={c - (v / 100) * c} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold tabular-nums">{v}%</span>
    </div>
  );
}

/** Mini gráfico de línea (sparkline) en SVG, sin librerías. */
export function MiniGrafico({ valores, className, tipo = "linea" }: { valores: number[]; className?: string; tipo?: "linea" | "barras" }) {
  const w = 120;
  const h = 36;
  const max = Math.max(1, ...valores);
  if (tipo === "barras") {
    const bw = w / Math.max(valores.length, 1);
    return (
      <svg viewBox={`0 0 ${w} ${h}`} className={cn("h-9 w-full", className)} aria-hidden preserveAspectRatio="none">
        {valores.map((v, i) => {
          const bh = Math.max(2, (v / max) * (h - 4));
          return <rect key={i} x={i * bw + 3} y={h - bh} width={bw - 6} height={bh} rx={2} className="fill-current opacity-80" />;
        })}
      </svg>
    );
  }
  const pts = valores.map((v, i) => [valores.length > 1 ? (i / (valores.length - 1)) * w : w / 2, h - 3 - (v / max) * (h - 6)] as const);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${d} L${w},${h} L0,${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cn("h-9 w-full", className)} aria-hidden preserveAspectRatio="none">
      <path d={area} className="fill-current opacity-10" />
      <path d={d} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" className="stroke-current" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function TarjetaKpi({
  titulo,
  valor,
  detalle,
  icono: Icono,
  tono,
  variacion,
  grafico,
  testid,
}: {
  titulo: string;
  valor: React.ReactNode;
  detalle?: React.ReactNode;
  icono: LucideIcon;
  tono: "primario" | "exito" | "aviso" | "peligro";
  variacion?: { texto: string; positiva: boolean | null };
  grafico?: React.ReactNode;
  testid?: string;
}) {
  const tonos = {
    primario: "bg-primary-soft text-primary",
    exito: "bg-exito-soft text-exito",
    aviso: "bg-aviso-soft text-aviso",
    peligro: "bg-peligro-soft text-peligro",
  };
  return (
    <div className="flex min-w-0 flex-col rounded-xl border border-border bg-surface p-3.5 shadow-xs sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[13px] font-medium text-muted-foreground">{titulo}</p>
        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", tonos[tono])}>
          <Icono className="size-4" aria-hidden />
        </span>
      </div>
      <p className="mt-2 text-xl font-semibold tracking-tight tabular-nums sm:text-2xl" data-testid={testid}>
        {valor}
      </p>
      <div className="mt-1 flex min-h-5 flex-wrap items-center gap-x-2 text-xs leading-snug text-muted-foreground [&>span:last-child]:line-clamp-2">
        {variacion && (
          <span className={cn("font-medium", variacion.positiva === null ? "" : variacion.positiva ? "text-exito" : "text-peligro")}>{variacion.texto}</span>
        )}
        {detalle}
      </div>
      {grafico && <div className={cn("mt-3", { primario: "text-primary", exito: "text-exito", aviso: "text-aviso", peligro: "text-peligro" }[tono])}>{grafico}</div>}
    </div>
  );
}

/** Botón "?" que lleva a la sección del manual de uso (/panel/ayuda#seccion) de la pantalla actual. */
export function BotonAyuda({ seccion, className }: { seccion: string; className?: string }) {
  return (
    <Link
      href={`/panel/ayuda#${seccion}`}
      title="Ayuda sobre esta pantalla"
      aria-label="Ayuda sobre esta pantalla"
      data-testid="boton-ayuda"
      className={cn("inline-flex size-7 shrink-0 items-center justify-center rounded-full text-subtle-foreground transition-colors hover:bg-primary-soft hover:text-primary", className)}
    >
      <CircleHelp className="size-[18px]" aria-hidden />
    </Link>
  );
}

export function EncabezadoPagina({ titulo, descripcion, acciones, migas, ayuda, children }: { titulo: React.ReactNode; descripcion?: React.ReactNode; acciones?: React.ReactNode; migas?: React.ReactNode; ayuda?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 space-y-3">
      {migas}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="flex items-center gap-1.5 text-2xl font-semibold tracking-tight text-balance">
            {titulo}
            {ayuda && <BotonAyuda seccion={ayuda} />}
          </h1>
          {descripcion && <div className="text-sm text-muted-foreground">{descripcion}</div>}
        </div>
        {acciones && <div className="flex shrink-0 flex-wrap items-center gap-2">{acciones}</div>}
      </div>
      {children}
    </div>
  );
}

export function Migas({ items }: { items: { etiqueta: string; href?: string }[] }) {
  return (
    <nav aria-label="Ruta" className="text-[13px] text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden>/</span>}
            {it.href ? (
              <a href={it.href} className="hover:text-foreground">
                {it.etiqueta}
              </a>
            ) : (
              <span className="text-foreground">{it.etiqueta}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Lista de definición compacta (dato: valor). */
export function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-foreground">{etiqueta}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium">{children}</dd>
    </div>
  );
}
