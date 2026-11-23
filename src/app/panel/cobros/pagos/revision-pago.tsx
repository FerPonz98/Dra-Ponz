"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Aviso } from "@/components/ui/aviso";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { accionAprobarPago, accionRechazarPago } from "../acciones";

export function RevisionPago({ pagoId }: { pagoId: string }) {
  const router = useRouter();
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState("");
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
    <div className="space-y-2">
      {res && <Aviso tipo={res.ok ? "exito" : "error"}>{res.mensaje}</Aviso>}
      {rechazando ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input aria-label="Motivo del rechazo" placeholder="Motivo del rechazo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <Button variant="destructive" disabled={ocupado} onClick={() => correr(() => accionRechazarPago(pagoId, motivo))}>
            Confirmar rechazo
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button disabled={ocupado} onClick={() => correr(() => accionAprobarPago(pagoId))}>
            Aprobar
          </Button>
          <Button variant="outline" disabled={ocupado} onClick={() => setRechazando(true)}>
            Rechazar
          </Button>
        </div>
      )}
    </div>
  );
}
