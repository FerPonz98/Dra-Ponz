"use client";
import { Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Confirmar } from "@/components/ui/dialogo";
import { Campo, Textarea } from "@/components/ui/input";
import { notificar } from "@/components/ui/toaster";
import { accionAprobarPago, accionRechazarPago } from "../acciones";

export function RevisionPago({ pagoId, compacto }: { pagoId: string; compacto?: boolean }) {
  const router = useRouter();
  const [motivo, setMotivo] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function aprobar() {
    setOcupado(true);
    const r = await accionAprobarPago(pagoId);
    setOcupado(false);
    if (r.ok) {
      // La tarjeta sale de la lista de pendientes: el aviso queda en la página de comprobantes.
      if (!compacto) router.replace("/panel/cobros/pagos?hecho=aprobado");
      else notificar(r);
      router.refresh();
    } else notificar(r);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="exito" disabled={ocupado} onClick={aprobar}>
        <Check /> Aprobar
      </Button>
      <Confirmar
        disparador={
          <Button size="sm" variant="outline" disabled={ocupado}>
            <X /> Rechazar
          </Button>
        }
        titulo="Rechazar comprobante"
        descripcion="El cliente verá el motivo en su portal y podrá subir otro comprobante."
        confirmar="Confirmar rechazo"
        peligroso
        alConfirmar={async () => {
          const r = await accionRechazarPago(pagoId, motivo);
          if (!r.ok) {
            notificar(r);
            throw new Error(r.mensaje);
          }
          if (!compacto) router.replace("/panel/cobros/pagos?hecho=rechazado");
          else notificar(r);
          router.refresh();
        }}
      >
        <Campo etiqueta="Motivo del rechazo" htmlFor={`motivo-${pagoId}`}>
          <Textarea id={`motivo-${pagoId}`} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. El monto no coincide o la imagen no se lee bien" rows={3} />
        </Campo>
      </Confirmar>
    </div>
  );
}
