"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Resultado } from "@/lib/acciones";
import { Aviso } from "@/components/ui/aviso";
import { Button } from "@/components/ui/button";

/** Botón del portal que ejecuta una acción del servidor y muestra el resultado. */
export function BotonPortal({ etiqueta, accion, confirmar, variante = "default" }: { etiqueta: string; accion: () => Promise<Resultado>; confirmar?: string; variante?: "default" | "outline" | "secondary" }) {
  const router = useRouter();
  const [res, setRes] = useState<Resultado | null>(null);
  const [ocupado, setOcupado] = useState(false);
  return (
    <div className="space-y-2">
      {res && <Aviso tipo={res.ok ? "exito" : "error"}>{res.mensaje}</Aviso>}
      <Button
        variant={variante}
        disabled={ocupado}
        className="w-full sm:w-auto"
        onClick={async () => {
          if (confirmar && !confirm(confirmar)) return;
          setOcupado(true);
          const r = await accion();
          setOcupado(false);
          setRes(r);
          if (r.ok) router.refresh();
        }}
      >
        {etiqueta}
      </Button>
    </div>
  );
}
