"use client";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { aCentavos, centavosATexto, formatoMoneda, type CodigoMoneda } from "@/lib/dinero";
import { sumarMeses } from "@/lib/fechas";

export type FilaCuota = { id?: string; concepto?: string | null; montoCentavos: number; fechaVencimiento: string; estado?: "pendiente" | "pagada" };

type Props = { value: FilaCuota[]; onChange: (v: FilaCuota[]) => void; moneda: CodigoMoneda; hoy: string };

/** Tabla editable de cuotas: monto y fecha por cuota, agregar/quitar, total automático. */
export function EditorCuotas({ value, onChange, moneda, hoy }: Props) {
  const [n, setN] = useState(String(value.length || 3));
  const [total, setTotal] = useState("");
  const [desde, setDesde] = useState(hoy);
  const totalCentavos = value.reduce((s, c) => s + (c.montoCentavos || 0), 0);
  const pagadas = value.filter((c) => c.estado === "pagada");

  function generar() {
    const cant = Math.max(1, Math.min(120, Number(n) || 1));
    const t = aCentavos(total) ?? 0;
    const base = Math.floor(t / cant);
    const nuevas: FilaCuota[] = Array.from({ length: cant }, (_, i) => ({
      montoCentavos: i === cant - 1 ? t - base * (cant - 1) : base,
      fechaVencimiento: sumarMeses(desde, i),
    }));
    onChange([...pagadas, ...nuevas]);
  }
  const editar = (i: number, cambio: Partial<FilaCuota>) => onChange(value.map((c, j) => (j === i ? { ...c, ...cambio } : c)));
  const ultimaFecha = value.at(-1)?.fechaVencimiento ?? hoy;
  const acciones = (i: number, pagada: boolean) =>
    pagada ? (
      <span className="text-xs font-medium text-emerald-700">Pagada</span>
    ) : (
      <Button type="button" variant="ghost" size="icon" aria-label={`Quitar cuota ${i + 1}`} onClick={() => onChange(value.filter((_, j) => j !== i))}>
        <Trash2 />
      </Button>
    );

  return (
    <div className="space-y-4">
      <fieldset className="grid grid-cols-2 gap-3 rounded-md border p-3 sm:grid-cols-4">
        <legend className="px-1 text-xs text-muted-foreground">Generar cuotas mensuales</legend>
        <div className="space-y-1">
          <Label htmlFor="gen-n">N.º de cuotas</Label>
          <Input id="gen-n" inputMode="numeric" value={n} onChange={(e) => setN(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="gen-total">Total ({moneda})</Label>
          <Input id="gen-total" inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} placeholder="0.00" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="gen-desde">1.ª fecha</Label>
          <Input id="gen-desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div className="flex items-end">
          <Button type="button" variant="secondary" className="w-full" onClick={generar}>
            Generar
          </Button>
        </div>
      </fieldset>

      <ol className="space-y-2" aria-label="Cuotas">
        {value.map((c, i) => {
          const pagada = c.estado === "pagada";
          return (
            <li key={c.id ?? `n${i}`} className="grid grid-cols-2 items-end gap-2 rounded-md border bg-background p-2 sm:grid-cols-[2rem_1fr_1fr_1fr_auto]" data-testid="fila-cuota">
              <div className="col-span-2 flex items-center justify-between sm:col-span-1 sm:pb-2">
                <span className="text-sm font-semibold text-muted-foreground">
                  <span className="sm:hidden">Cuota </span>
                  {i + 1}
                </span>
                <span className="sm:hidden">{acciones(i, pagada)}</span>
              </div>
              <div className="space-y-1">
                <Label htmlFor={`monto-${i}`} className="text-xs">
                  Monto
                </Label>
                <Input
                  id={`monto-${i}`}
                  inputMode="decimal"
                  disabled={pagada}
                  defaultValue={c.montoCentavos ? centavosATexto(c.montoCentavos) : ""}
                  key={`m-${c.id ?? i}-${c.montoCentavos}`}
                  onBlur={(e) => editar(i, { montoCentavos: aCentavos(e.target.value) ?? 0 })}
                  aria-label={`Monto cuota ${i + 1}`}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`fecha-${i}`} className="text-xs">
                  Vence
                </Label>
                <Input id={`fecha-${i}`} type="date" value={c.fechaVencimiento} onChange={(e) => editar(i, { fechaVencimiento: e.target.value })} aria-label={`Fecha cuota ${i + 1}`} />
              </div>
              <div className="col-span-2 space-y-1 sm:col-span-1">
                <Label htmlFor={`concepto-${i}`} className="text-xs">
                  Concepto (opcional)
                </Label>
                <Input id={`concepto-${i}`} value={c.concepto ?? ""} onChange={(e) => editar(i, { concepto: e.target.value })} />
              </div>
              <div className="hidden pb-0.5 sm:block">{acciones(i, pagada)}</div>
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...value, { montoCentavos: value.at(-1)?.montoCentavos ?? 0, fechaVencimiento: sumarMeses(ultimaFecha, value.length ? 1 : 0) }])}>
          <Plus /> Agregar cuota
        </Button>
        <p className="text-sm">
          Total: <strong data-testid="total-plan">{formatoMoneda(totalCentavos, moneda)}</strong> · {value.length} cuotas
        </p>
      </div>
    </div>
  );
}
