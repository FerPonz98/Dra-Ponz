"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Resultado } from "@/lib/acciones";
import { Aviso } from "@/components/ui/aviso";
import { Button } from "@/components/ui/button";
import { Confirmar } from "@/components/ui/dialogo";

/** Botón del portal que ejecuta una acción del servidor (con confirmación opcional) y muestra el resultado. */
export function BotonPortal({
  etiqueta,
  accion,
  confirmar,
  descripcion,
  textoConfirmar,
  variante = "default",
  grande,
}: {
  etiqueta: string;
  accion: () => Promise<Resultado>;
  confirmar?: string;
  descripcion?: string;
  textoConfirmar?: string;
  variante?: "default" | "outline" | "secondary";
  grande?: boolean;
}) {
  const router = useRouter();
  const [res, setRes] = useState<Resultado | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const correr = async () => {
    setOcupado(true);
    const r = await accion();
    setOcupado(false);
    setRes(r);
    if (r.ok) router.refresh();
  };
  const boton = (
    <Button variant={variante} disabled={ocupado} size={grande ? "lg" : "default"} className={grande ? "h-14 w-full rounded-2xl text-base" : "w-full sm:w-auto"} onClick={confirmar ? undefined : correr}>
      {etiqueta}
    </Button>
  );
  return (
    <div className="space-y-2">
      {res && <Aviso tipo={res.ok ? "exito" : "error"}>{res.mensaje}</Aviso>}
      {confirmar ? <Confirmar disparador={boton} titulo={confirmar} descripcion={descripcion} confirmar={textoConfirmar ?? "Sí, confirmo"} alConfirmar={correr} /> : boton}
    </div>
  );
}
