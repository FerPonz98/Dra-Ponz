"use client";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { plantillaCronograma, type ActividadCronograma } from "@/modules/tesis/dominio/cronograma";

export type ValorCronograma = { fechaInicio: string; meses: number; actividades: ActividadCronograma[] };

/** Tabla editable actividades × meses. */
export function EditorCronograma({ value, onChange }: { value: ValorCronograma; onChange: (v: ValorCronograma) => void }) {
  const meses = Array.from({ length: value.meses }, (_, i) => i + 1);
  const setAct = (i: number, c: Partial<ActividadCronograma>) => onChange({ ...value, actividades: value.actividades.map((a, j) => (j === i ? { ...a, ...c } : a)) });
  const cambiarMeses = (n: number) => {
    const m = Math.max(1, Math.min(36, n || 1));
    onChange({ ...value, meses: m, actividades: value.actividades.map((a) => ({ ...a, meses: a.meses.filter((x) => x <= m) })) });
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="cr-inicio">Inicio</Label>
          <Input id="cr-inicio" type="date" value={value.fechaInicio} onChange={(e) => onChange({ ...value, fechaInicio: e.target.value })} />
        </div>
        <div className="w-28 space-y-1">
          <Label htmlFor="cr-meses">Meses</Label>
          <Input id="cr-meses" type="number" min={1} max={36} value={value.meses} onChange={(e) => cambiarMeses(Number(e.target.value))} />
        </div>
        <Button type="button" variant="secondary" onClick={() => onChange({ ...value, meses: Math.max(value.meses, 5), actividades: plantillaCronograma(Math.max(value.meses, 5)) })}>
          Cargar plantilla
        </Button>
      </div>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[36rem] text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="p-2 text-left font-medium">Actividad</th>
              {meses.map((m) => (
                <th key={m} className="w-12 p-2 text-center font-medium">
                  M{m}
                </th>
              ))}
              <th className="w-20 p-2 text-center text-xs font-medium">Estudiante</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {value.actividades.map((a, i) => (
              <tr key={a.id ?? i} className="border-b last:border-0" data-testid="fila-actividad">
                <td className="p-1">
                  <Input aria-label={`Actividad ${i + 1}`} value={a.nombre} onChange={(e) => setAct(i, { nombre: e.target.value })} />
                </td>
                {meses.map((m) => (
                  <td key={m} className="p-1 text-center">
                    <input
                      type="checkbox"
                      className="size-4"
                      aria-label={`${a.nombre || `Actividad ${i + 1}`} en mes ${m}`}
                      checked={a.meses.includes(m)}
                      onChange={(e) => setAct(i, { meses: e.target.checked ? [...a.meses, m].sort((x, y) => x - y) : a.meses.filter((x) => x !== m) })}
                    />
                  </td>
                ))}
                <td className="p-1 text-center">
                  <input type="checkbox" className="size-4" aria-label={`${a.nombre} a cargo del estudiante`} checked={a.aCargoEstudiante} onChange={(e) => setAct(i, { aCargoEstudiante: e.target.checked })} />
                </td>
                <td className="p-1">
                  <Button type="button" variant="ghost" size="icon" aria-label={`Quitar actividad ${i + 1}`} onClick={() => onChange({ ...value, actividades: value.actividades.filter((_, j) => j !== i) })}>
                    <Trash2 />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={() => onChange({ ...value, actividades: [...value.actividades, { nombre: "", meses: [1], aCargoEstudiante: false }] })}>
        <Plus /> Agregar actividad
      </Button>
    </div>
  );
}
