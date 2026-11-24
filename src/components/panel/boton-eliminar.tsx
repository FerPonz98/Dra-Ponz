"use client";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Confirmar } from "@/components/ui/dialogo";
import { notificar } from "@/components/ui/toaster";
import type { Resultado } from "@/lib/acciones";

/** Botón rojo «Eliminar …» con confirmación. Al confirmar llama a la acción (que redirige a la lista si sale bien). */
export function BotonEliminar({ etiqueta, titulo, descripcion, accion }: { etiqueta: string; titulo: string; descripcion: string; accion: () => Promise<Resultado> }) {
  return (
    <Confirmar
      disparador={
        <Button variant="outline" size="sm" className="border-peligro/30 text-peligro hover:bg-peligro-soft" data-testid="boton-eliminar">
          <Trash2 /> {etiqueta}
        </Button>
      }
      titulo={titulo}
      descripcion={descripcion}
      confirmar="Sí, eliminar"
      peligroso
      alConfirmar={async () => {
        const r = await accion();
        if (r && !r.ok) {
          notificar(r);
          throw new Error(r.mensaje);
        }
      }}
    />
  );
}
