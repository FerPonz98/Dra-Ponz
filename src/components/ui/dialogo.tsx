"use client";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

const capa = "fixed inset-0 z-50 bg-stone-950/40 backdrop-blur-[2px] data-[state=open]:animate-[aparecer_.15s_ease-out]";

/** Diálogo de confirmación para acciones importantes o peligrosas. */
export function Confirmar({
  disparador,
  titulo,
  descripcion,
  confirmar = "Confirmar",
  cancelar = "Cancelar",
  peligroso,
  alConfirmar,
  children,
}: {
  disparador: React.ReactNode;
  titulo: string;
  descripcion?: React.ReactNode;
  confirmar?: string;
  cancelar?: string;
  peligroso?: boolean;
  alConfirmar: () => void | Promise<void>;
  children?: React.ReactNode;
}) {
  const [abierto, setAbierto] = React.useState(false);
  const [ocupado, setOcupado] = React.useState(false);
  return (
    <AlertDialog.Root open={abierto} onOpenChange={setAbierto}>
      <AlertDialog.Trigger asChild>{disparador}</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={capa} />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-lg focus:outline-none">
          <AlertDialog.Title className="text-lg font-semibold tracking-tight">{titulo}</AlertDialog.Title>
          {descripcion && <AlertDialog.Description className="mt-2 text-sm text-muted-foreground">{descripcion}</AlertDialog.Description>}
          {children && <div className="mt-4">{children}</div>}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Cancel asChild>
              <Button variant="outline">{cancelar}</Button>
            </AlertDialog.Cancel>
            <Button
              variant={peligroso ? "destructive" : "default"}
              disabled={ocupado}
              onClick={async () => {
                setOcupado(true);
                try {
                  await alConfirmar();
                  setAbierto(false);
                } finally {
                  setOcupado(false);
                }
              }}
            >
              {confirmar}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

/** Panel lateral (detalle) que entra desde la derecha; en el celular ocupa toda la pantalla. */
export function PanelLateral({ abierto, alCambiar, titulo, descripcion, children }: { abierto: boolean; alCambiar: (v: boolean) => void; titulo: string; descripcion?: string; children: React.ReactNode }) {
  return (
    <Dialog.Root open={abierto} onOpenChange={alCambiar}>
      <Dialog.Portal>
        <Dialog.Overlay className={capa} />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-surface shadow-lg focus:outline-none data-[state=open]:animate-[aparecer_.2s_ease-out]">
          <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div>
              <Dialog.Title className="text-base font-semibold">{titulo}</Dialog.Title>
              {descripcion ? <Dialog.Description className="text-sm text-muted-foreground">{descripcion}</Dialog.Description> : <Dialog.Description className="sr-only">{titulo}</Dialog.Description>}
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Cerrar">
                <X />
              </Button>
            </Dialog.Close>
          </div>
          <div className={cn("flex-1 overflow-y-auto px-5 py-4")}>{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
