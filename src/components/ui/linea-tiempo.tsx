import { cn } from "@/lib/utils";

export type EventoLinea = { id: string; fecha: string; titulo: React.ReactNode; detalle?: React.ReactNode; autor?: string | null; tono?: "normal" | "exito" | "aviso" | "peligro" | "primario" };

const TONO = {
  normal: "bg-border-strong",
  exito: "bg-exito",
  aviso: "bg-aviso",
  peligro: "bg-peligro",
  primario: "bg-primary",
};

/** Línea de tiempo vertical (historial). */
export function LineaTiempo({ eventos, testid, vacio = "Sin movimientos todavía." }: { eventos: EventoLinea[]; testid?: string; vacio?: string }) {
  if (!eventos.length) return <p className="text-sm text-muted-foreground">{vacio}</p>;
  return (
    <ol className="relative space-y-5 before:absolute before:bottom-1 before:left-[5px] before:top-1 before:w-px before:bg-border" data-testid={testid}>
      {eventos.map((e) => (
        <li key={e.id} className="relative pl-6">
          <span aria-hidden className={cn("absolute left-0 top-1.5 size-[11px] rounded-full ring-4 ring-surface", TONO[e.tono ?? "normal"])} />
          <p className="text-sm font-medium leading-5">{e.titulo}</p>
          {e.detalle && <div className="mt-0.5 text-sm text-muted-foreground">{e.detalle}</div>}
          <p className="mt-1 text-xs text-subtle-foreground">
            {e.fecha}
            {e.autor ? ` · ${e.autor}` : ""}
          </p>
        </li>
      ))}
    </ol>
  );
}
