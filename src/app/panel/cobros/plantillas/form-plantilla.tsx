"use client";
import { useState } from "react";
import { Aviso } from "@/components/ui/aviso";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { rellenarPlantilla } from "@/modules/cobros/dominio/mensajes";
import { accionGuardarPlantilla } from "../acciones";

const EJEMPLO = { nombre: "Ana", monto: "350.00", moneda: "BOB", fecha: "15/03/2026", enlace: "https://julietaponz.com/p/…", proyecto: "Tesis de maestría" };

export function FormPlantilla({ clave, cuerpo }: { clave: string; cuerpo: string }) {
  const [texto, setTexto] = useState(cuerpo);
  const [res, setRes] = useState<{ ok: boolean; mensaje?: string } | null>(null);
  return (
    <div className="space-y-2">
      <Textarea aria-label={`Plantilla ${clave}`} value={texto} onChange={(e) => setTexto(e.target.value)} rows={3} />
      <p className="rounded bg-muted p-2 text-xs">
        <span className="font-medium">Vista previa: </span>
        {rellenarPlantilla(texto, EJEMPLO)}
      </p>
      {res && <Aviso tipo={res.ok ? "exito" : "error"}>{res.mensaje}</Aviso>}
      <Button size="sm" onClick={async () => setRes(await accionGuardarPlantilla(clave, texto))}>
        Guardar
      </Button>
    </div>
  );
}
