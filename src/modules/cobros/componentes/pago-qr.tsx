"use client";
import { ArrowLeft, Upload } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ZonaArchivos } from "@/components/ui/zona-archivos";

/** Botón "Ya pagué" que muestra la zona para subir el comprobante. */
export function SubirComprobanteQr({ url, cuotaId }: { url: string; cuotaId: string }) {
  const [abierto, setAbierto] = useState(false);
  if (!abierto)
    return (
      <Button size="lg" className="h-14 w-full rounded-2xl text-base" onClick={() => setAbierto(true)}>
        <Upload /> Ya pagué, subir comprobante
      </Button>
    );
  return (
    <div className="space-y-3">
      <ZonaArchivos
        url={url}
        campo="comprobante"
        extras={{ cuotaId }}
        etiqueta="Comprobante (foto o PDF, máx. 50 MB)"
        ayuda="Una captura o foto clara del comprobante de tu banco."
        accept="image/png,image/jpeg,image/webp,application/pdf"
        textoBoton="Enviar comprobante"
      />
      <Button variant="ghost" className="w-full" onClick={() => setAbierto(false)}>
        <ArrowLeft /> Volver
      </Button>
    </div>
  );
}
