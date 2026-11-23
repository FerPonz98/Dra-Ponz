"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Campo, Input, Select } from "@/components/ui/input";
import { ListaPestanas, PanelPestana, Pestana, Pestanas } from "@/components/ui/tabs";
import { notificar } from "@/components/ui/toaster";
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
  const [ocupado, setOcupado] = useState(false);

  async function correr(fn: () => Promise<{ ok: boolean; mensaje?: string }>) {
    setOcupado(true);
    const r = await fn();
    setOcupado(false);
    notificar(r);
    if (r.ok) router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Editar plan</CardTitle>
        <CardDescription>Montos y fechas se pueden cambiar en cualquier momento; cada cambio queda en el historial.</CardDescription>
      </CardHeader>
      <CardContent>
        <Pestanas defaultValue="cuotas">
          <ListaPestanas aria-label="Secciones de edición">
            <Pestana value="cuotas">Cuotas</Pestana>
            <Pestana value="mora">Reglas de mora</Pestana>
            <Pestana value="datos">Datos</Pestana>
          </ListaPestanas>
          <PanelPestana value="cuotas" className="space-y-4">
            <EditorCuotas value={cuotas} onChange={setCuotas} moneda={moneda} hoy={props.hoy} />
            <Button disabled={ocupado} onClick={() => correr(() => accionGuardarCuotas(props.planId, cuotas))}>
              Guardar cuotas
            </Button>
          </PanelPestana>
          <PanelPestana value="mora" className="space-y-4">
            <EditorReglas value={reglas} onChange={setReglas} />
            <Button disabled={ocupado} onClick={() => correr(() => accionGuardarReglas(props.planId, reglas))}>
              Guardar reglas
            </Button>
          </PanelPestana>
          <PanelPestana value="datos">
            <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
              <Campo etiqueta="Concepto" htmlFor="e-titulo">
                <Input id="e-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
              </Campo>
              <Campo etiqueta="Moneda" htmlFor="e-moneda">
                <Select id="e-moneda" value={moneda} onChange={(e) => setMoneda(e.target.value as "BOB" | "BRL")}>
                  <option value="BOB">BOB</option>
                  <option value="BRL">BRL</option>
                </Select>
              </Campo>
            </div>
            <Button className="mt-4" disabled={ocupado} onClick={() => correr(() => accionDatosPlan(props.planId, { titulo, moneda }))}>
              Guardar datos
            </Button>
          </PanelPestana>
        </Pestanas>
      </CardContent>
    </Card>
  );
}
