"use client";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Confirmar } from "@/components/ui/dialogo";
import { notificar } from "@/components/ui/toaster";
import type { Resultado } from "@/lib/acciones";

/**
 * Botón rojo «Eliminar …» con confirmación. Al confirmar llama a la acción: si redirige (p. ej. a la lista) se sigue
 * la redirección; si devuelve un resultado, se avisa y se refresca la página.
 */
export function BotonEliminar({ etiqueta, titulo, descripcion, accion, compacto }: { etiqueta: string; titulo: string; descripcion: string; accion: () => Promise<Resultado>; compacto?: boolean }) {
  const router = useRouter();
  return (
    <Confirmar
      disparador={
        compacto ? (
          <Button variant="ghost" size="icon-sm" className="text-peligro hover:bg-peligro-soft hover:text-peligro" aria-label={etiqueta} title={etiqueta} data-testid="boton-eliminar-compacto">
            <Trash2 />
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="border-peligro/30 text-peligro hover:bg-peligro-soft" data-testid="boton-eliminar">
            <Trash2 /> {etiqueta}
          </Button>
        )
      }
      titulo={titulo}
      descripcion={descripcion}
      confirmar="Sí, eliminar"
      peligroso
      alConfirmar={async () => {
        const r = await accion();
        notificar(r);
        if (r && !r.ok) throw new Error(r.mensaje);
        router.refresh();
      }}
    />
  );
}
