import { Esqueleto } from "@/components/ui/varios";

/** Skeleton de carga del panel mientras llega la página. */
export default function Cargando() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando…</span>
      <div className="space-y-2">
        <Esqueleto className="h-7 w-64" />
        <Esqueleto className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="space-y-3 rounded-xl border border-border bg-surface p-4">
            <Esqueleto className="h-4 w-24" />
            <Esqueleto className="h-7 w-32" />
            <Esqueleto className="h-9 w-full" />
          </div>
        ))}
      </div>
      <div className="space-y-3 rounded-xl border border-border bg-surface p-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Esqueleto className="size-9 rounded-full" />
            <div className="flex-1 space-y-2">
              <Esqueleto className="h-4 w-1/3" />
              <Esqueleto className="h-3 w-1/2" />
            </div>
            <Esqueleto className="h-8 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
