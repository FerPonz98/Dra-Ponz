"use client";
import { useState } from "react";
import { Aviso } from "@/components/ui/aviso";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Campo, Input, Select } from "@/components/ui/input";
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
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function guardar() {
    setEnviando(true);
    setError(null);
    const r = await accionCrearPlan({ clienteId, titulo, moneda, cuotas, reglas });
    setEnviando(false);
    if (r && !r.ok) setError(r.mensaje);
  }

  return (
    <div className="space-y-4">
      {error && <Aviso tipo="error">{error}</Aviso>}
      <Card>
        <CardHeader>
          <CardTitle>Datos</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Campo etiqueta="Cliente" htmlFor="p-cliente">
            <Select id="p-cliente" value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
              <option value="">Elige…</option>
              {props.clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo etiqueta="Concepto" htmlFor="p-titulo">
            <Input id="p-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Tratamiento, curso, asesoría…" />
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
        </CardHeader>
        <CardContent>
          <EditorCuotas value={cuotas} onChange={setCuotas} moneda={moneda} hoy={props.hoy} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Reglas de mora (opcionales)</CardTitle>
        </CardHeader>
        <CardContent>
          <EditorReglas value={reglas} onChange={setReglas} />
        </CardContent>
      </Card>
      <Button onClick={guardar} disabled={enviando} size="lg">
        {enviando ? "Guardando…" : "Crear plan"}
      </Button>
    </div>
  );
}
