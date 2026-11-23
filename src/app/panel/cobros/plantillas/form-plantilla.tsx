"use client";
import { MessageCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { notificar } from "@/components/ui/toaster";
import { rellenarPlantilla } from "@/modules/cobros/dominio/mensajes";
import { accionGuardarPlantilla } from "../acciones";

const EJEMPLO = { nombre: "Ana", monto: "350.00", moneda: "BOB", fecha: "15/03/2026", enlace: "https://julietaponz.com/p/…", proyecto: "Tesis de maestría" };

export function FormPlantilla({ clave, cuerpo }: { clave: string; cuerpo: string }) {
  const [texto, setTexto] = useState(cuerpo);
  const [ocupado, setOcupado] = useState(false);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-3">
        <Textarea aria-label={`Plantilla ${clave}`} value={texto} onChange={(e) => setTexto(e.target.value)} rows={4} />
        <Button
          size="sm"
          disabled={ocupado || texto === cuerpo}
          onClick={async () => {
            setOcupado(true);
            notificar(await accionGuardarPlantilla(clave, texto));
            setOcupado(false);
          }}
        >
          Guardar
        </Button>
      </div>
      <div>
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">Vista previa</p>
        <div className="rounded-xl bg-[#e7ffdb] p-3 text-sm text-stone-900 shadow-xs dark:bg-[#0b3d2b] dark:text-stone-100">
          <p className="whitespace-pre-line">{rellenarPlantilla(texto, EJEMPLO)}</p>
          <p className="mt-1 flex items-center justify-end gap-1 text-[11px] text-stone-500 dark:text-stone-300">
            <MessageCircle className="size-3" aria-hidden /> WhatsApp
          </p>
        </div>
      </div>
    </div>
  );
}
