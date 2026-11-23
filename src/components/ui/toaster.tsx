"use client";
import { Toaster as Sonner, toast } from "sonner";

export function Toaster() {
  return (
    <Sonner
      position="top-right"
      closeButton
      richColors
      toastOptions={{ classNames: { toast: "!rounded-xl !border !border-border !shadow-lg !font-sans", title: "!text-sm !font-medium" } }}
    />
  );
}

/** Muestra un toast de éxito o error según el resultado de una acción del servidor. */
export function notificar(r: { ok: boolean; mensaje?: string } | null | undefined) {
  if (!r) return;
  if (r.ok) {
    if (r.mensaje) toast.success(r.mensaje);
  } else toast.error(r.mensaje ?? "Algo salió mal. Inténtalo de nuevo.");
}

export { toast };
