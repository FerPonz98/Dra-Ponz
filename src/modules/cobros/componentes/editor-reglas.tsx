"use client";
import { Input, Label, Select } from "@/components/ui/input";
import type { ReglasMora } from "@/modules/cobros/dominio/plan";

const num = (v: string) => (v.trim() === "" ? null : Number(v));

/** Reglas de mora del plan (todas opcionales). */
export function EditorReglas({ value, onChange }: { value: ReglasMora; onChange: (r: ReglasMora) => void }) {
  const set = (c: Partial<ReglasMora>) => onChange({ ...value, ...c });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1">
        <Label htmlFor="r-plazo">Plazo para pagar la 1.ª cuota tras aceptar (días)</Label>
        <Input id="r-plazo" type="number" min={0} max={365} value={value.plazoPrimeraCuotaDias ?? ""} onChange={(e) => set({ plazoPrimeraCuotaDias: num(e.target.value) })} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="r-gracia">Días de gracia (0–30)</Label>
        <Input id="r-gracia" type="number" min={0} max={30} value={value.diasGracia ?? ""} onChange={(e) => set({ diasGracia: num(e.target.value) })} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="r-gracia2">Gracia en una nueva mora (días)</Label>
        <Input id="r-gracia2" type="number" min={0} max={90} value={value.diasGraciaNuevaMora ?? ""} onChange={(e) => set({ diasGraciaNuevaMora: num(e.target.value) })} />
      </div>
      <div className="flex items-center gap-2 pt-6">
        <input id="r-recargo" type="checkbox" className="size-4" checked={value.recargoActivo} onChange={(e) => set({ recargoActivo: e.target.checked })} />
        <Label htmlFor="r-recargo">Aplicar recargo por mora</Label>
      </div>
      {value.recargoActivo && (
        <>
          <div className="space-y-1">
            <Label htmlFor="r-pct">Recargo (%)</Label>
            <Input id="r-pct" type="number" min={0} max={100} step="0.01" value={value.recargoPorcentaje ?? ""} onChange={(e) => set({ recargoPorcentaje: num(e.target.value) })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="r-modo">Aplicación</Label>
            <Select id="r-modo" value={value.recargoModo} onChange={(e) => set({ recargoModo: e.target.value as ReglasMora["recargoModo"] })}>
              <option value="unico">Única (una vez por cuota)</option>
              <option value="mensual">Por cada mes de atraso</option>
            </Select>
          </div>
        </>
      )}
    </div>
  );
}
