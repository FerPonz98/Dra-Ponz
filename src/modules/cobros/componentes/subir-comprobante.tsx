"use client";
import type { Resultado } from "@/lib/acciones";
import { useActionState } from "react";
import { Aviso } from "@/components/ui/aviso";
import { Button } from "@/components/ui/button";
import { Campo, Input } from "@/components/ui/input";

type Accion = (estado: Resultado | null, fd: FormData) => Promise<Resultado>;

export function SubirComprobante({ cuotaId, accion }: { cuotaId: string; accion: Accion }) {
  const [estado, enviar, pendiente] = useActionState(accion, null);
  return (
    <form action={enviar} className="space-y-3">
      {estado && <Aviso tipo={estado.ok ? "exito" : "error"}>{estado.mensaje}</Aviso>}
      <input type="hidden" name="cuotaId" value={cuotaId} />
      <Campo etiqueta="Comprobante (foto o PDF, máx. 50 MB)" htmlFor="comprobante">
        <Input id="comprobante" name="comprobante" type="file" accept="image/png,image/jpeg,image/webp,application/pdf" required />
      </Campo>
      <Button type="submit" disabled={pendiente} className="w-full sm:w-auto">
        {pendiente ? "Enviando…" : "Enviar comprobante"}
      </Button>
    </form>
  );
}
