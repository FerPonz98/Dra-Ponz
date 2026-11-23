"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Campo, Input, Select } from "@/components/ui/input";
import { notificar } from "@/components/ui/toaster";
import { formatoMoneda } from "@/lib/dinero";
import { formatoFecha } from "@/lib/fechas";
import { EditorCuotas, type FilaCuota } from "@/modules/cobros/componentes/editor-cuotas";
import { EditorReglas } from "@/modules/cobros/componentes/editor-reglas";
import { REGLAS_VACIAS, type ReglasMora } from "@/modules/cobros/dominio/plan";
import { accionCrearPlan } from "../../acciones";

export function FormPlan(props: { clientes: { id: string; nombre: string }[]; clienteInicial?: string; moneda: "BOB" | "BRL"; hoy: string }) {
  const [clienteId, setClienteId] = useState(props.clienteInicial ?? "");
  const [titulo, setTitulo] = useState("");
  const [moneda, setMoneda] = useState<"BOB" | "BRL">(props.moneda);
  const [cuotas, setCuotas] = useState<FilaCuota[]>([]);
  const [reglas, setReglas] = useState<ReglasMora>(REGLAS_VACIAS);
  const [enviando, setEnviando] = useState(false);
  const [intento, setIntento] = useState(false);
  const total = cuotas.reduce((s, c) => s + (c.montoCentavos || 0), 0);
  const errores = { cliente: !clienteId ? "Elige un cliente" : undefined, titulo: titulo.trim().length < 2 ? "Escribe un concepto" : undefined, cuotas: cuotas.length === 0 ? "Genera o agrega al menos una cuota" : undefined };

  async function guardar() {
    setIntento(true);
    if (errores.cliente || errores.titulo || errores.cuotas) return;
    setEnviando(true);
    const r = await accionCrearPlan({ clienteId, titulo, moneda, cuotas, reglas });
    setEnviando(false);
    if (r && !r.ok) notificar(r);
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Datos del plan</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <Campo etiqueta="Cliente" htmlFor="p-cliente" error={intento ? errores.cliente : undefined}>
              <Select id="p-cliente" value={clienteId} onChange={(e) => setClienteId(e.target.value)} aria-invalid={intento && !!errores.cliente}>
                <option value="">Elige…</option>
                {props.clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </Select>
            </Campo>
            <Campo etiqueta="Concepto" htmlFor="p-titulo" error={intento ? errores.titulo : undefined}>
              <Input id="p-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Tratamiento, curso, asesoría…" aria-invalid={intento && !!errores.titulo} />
            </Campo>
            <Campo etiqueta="Moneda" htmlFor="p-moneda">
              <Select id="p-moneda" value={moneda} onChange={(e) => setMoneda(e.target.value as "BOB" | "BRL")}>
                <option value="BOB">Bolivianos (BOB)</option>
                <option value="BRL">Reales (BRL)</option>
              </Select>
            </Campo>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Cuotas</CardTitle>
            <CardDescription>El total se calcula solo. Cada monto y fecha se puede editar.</CardDescription>
          </CardHeader>
          <CardContent>
            <EditorCuotas value={cuotas} onChange={setCuotas} moneda={moneda} hoy={props.hoy} />
            {intento && errores.cuotas && <p className="mt-2 text-xs font-medium text-peligro">{errores.cuotas}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Reglas de mora</CardTitle>
            <CardDescription>Todas son opcionales: completa solo las que uses.</CardDescription>
          </CardHeader>
          <CardContent>
            <EditorReglas value={reglas} onChange={setReglas} />
          </CardContent>
        </Card>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24">
        <Card>
          <CardHeader>
            <CardTitle>Resumen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total del plan</p>
              <p className="text-3xl font-semibold tracking-tight tabular-nums">{formatoMoneda(total, moneda)}</p>
              <p className="text-xs text-muted-foreground">{cuotas.length} {cuotas.length === 1 ? "cuota" : "cuotas"}</p>
            </div>
            {cuotas.length > 0 && (
              <ul className="max-h-56 space-y-1.5 overflow-y-auto text-sm">
                {cuotas.map((c, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span className="text-muted-foreground">
                      {i + 1}. {formatoFecha(c.fechaVencimiento)}
                    </span>
                    <span className="tabular-nums">{formatoMoneda(c.montoCentavos, moneda)}</span>
                  </li>
                ))}
              </ul>
            )}
            <Button onClick={guardar} disabled={enviando} size="lg" className="w-full">
              {enviando ? "Guardando…" : "Crear plan"}
            </Button>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
