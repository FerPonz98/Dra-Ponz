"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Aviso } from "@/components/ui/aviso";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Campo, Input, Select } from "@/components/ui/input";
import { EditorCuotas, type FilaCuota } from "@/modules/cobros/componentes/editor-cuotas";
import { EditorReglas } from "@/modules/cobros/componentes/editor-reglas";
import type { ReglasMora } from "@/modules/cobros/dominio/plan";
import { accionDatosPlan, accionGuardarCuotas, accionGuardarReglas } from "../../acciones";

type Props = { planId: string; titulo: string; moneda: "BOB" | "BRL"; hoy: string; cuotas: FilaCuota[]; reglas: ReglasMora };

export function EdicionPlan(props: Props) {
  const router = useRouter();
  const [titulo, setTitulo] = useState(props.titulo);
  const [moneda, setMoneda] = useState(props.moneda);
  const [cuotas, setCuotas] = useState(props.cuotas);
  const [reglas, setReglas] = useState(props.reglas);
  const [res, setRes] = useState<{ ok: boolean; mensaje?: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function correr(fn: () => Promise<{ ok: boolean; mensaje?: string }>) {
    setOcupado(true);
    const r = await fn();
    setRes(r);
    setOcupado(false);
    if (r.ok) router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Editar plan</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {res && <Aviso tipo={res.ok ? "exito" : "error"}>{res.mensaje}</Aviso>}
        <section className="grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
          <Campo etiqueta="Concepto" htmlFor="e-titulo">
            <Input id="e-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </Campo>
          <Campo etiqueta="Moneda" htmlFor="e-moneda">
            <Select id="e-moneda" value={moneda} onChange={(e) => setMoneda(e.target.value as "BOB" | "BRL")}>
              <option value="BOB">BOB</option>
              <option value="BRL">BRL</option>
            </Select>
          </Campo>
          <Button variant="outline" disabled={ocupado} onClick={() => correr(() => accionDatosPlan(props.planId, { titulo, moneda }))}>
            Guardar datos
          </Button>
        </section>
        <section className="space-y-3">
          <h3 className="font-medium">Cuotas (montos y fechas siempre editables)</h3>
          <EditorCuotas value={cuotas} onChange={setCuotas} moneda={moneda} hoy={props.hoy} />
          <Button disabled={ocupado} onClick={() => correr(() => accionGuardarCuotas(props.planId, cuotas))}>
            Guardar cuotas
          </Button>
        </section>
        <section className="space-y-3">
          <h3 className="font-medium">Reglas de mora</h3>
          <EditorReglas value={reglas} onChange={setReglas} />
          <Button variant="outline" disabled={ocupado} onClick={() => correr(() => accionGuardarReglas(props.planId, reglas))}>
            Guardar reglas
          </Button>
        </section>
      </CardContent>
    </Card>
  );
}
