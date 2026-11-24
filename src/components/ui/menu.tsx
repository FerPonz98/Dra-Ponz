"use client";
import * as DM from "@radix-ui/react-dropdown-menu";
import { MoreHorizontal, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import type { Resultado } from "@/lib/acciones";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Confirmar } from "./dialogo";
import { notificar } from "./toaster";

export const Menu = DM.Root;
export const MenuDisparador = DM.Trigger;

export function MenuContenido({ className, align = "end", ...props }: React.ComponentProps<typeof DM.Content>) {
  return (
    <DM.Portal>
      <DM.Content
        align={align}
        sideOffset={6}
        className={cn("z-50 min-w-48 rounded-xl border border-border bg-surface p-1.5 text-sm shadow-lg data-[state=open]:animate-[aparecer_.12s_ease-out]", className)}
        {...props}
      />
    </DM.Portal>
  );
}

export function MenuItem({ className, peligro, ...props }: React.ComponentProps<typeof DM.Item> & { peligro?: boolean }) {
  return (
    <DM.Item
      className={cn(
        "flex cursor-pointer select-none items-center gap-2 rounded-md px-2.5 py-2 outline-none data-[highlighted]:bg-muted [&_svg]:size-4 [&_svg]:text-muted-foreground",
        peligro && "text-peligro [&_svg]:text-peligro",
        className,
      )}
      {...props}
    />
  );
}
export const MenuSeparador = () => <DM.Separator className="my-1 h-px bg-border" />;
export function MenuEtiqueta({ children }: { children: React.ReactNode }) {
  return <DM.Label className="px-2.5 py-1.5 text-xs font-medium text-muted-foreground">{children}</DM.Label>;
}

/** Acción de eliminar con confirmación (la acción del servidor puede redirigir o devolver un resultado). */
export type EliminarFila = { titulo: string; descripcion: string; accion: () => Promise<Resultado> };
/** Elemento del menú de una fila: un enlace o «Eliminar» (con confirmación). */
export type AccionFila = { etiqueta: string; href: string } | { etiqueta: string; eliminar: EliminarFila };

/** Menú "⋯" de acciones de una fila (enlaces y, opcionalmente, eliminar). */
export function MenuAcciones({ acciones, etiqueta = "Más acciones" }: { acciones: AccionFila[]; etiqueta?: string }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = React.useState<EliminarFila | null>(null);
  if (!acciones.length) return null;
  const enlaces = acciones.filter((a): a is { etiqueta: string; href: string } => "href" in a);
  const borrar = acciones.filter((a): a is { etiqueta: string; eliminar: EliminarFila } => "eliminar" in a);
  return (
    <>
      <Menu>
        <MenuDisparador asChild>
          <Button variant="ghost" size="icon-sm" aria-label={etiqueta}>
            <MoreHorizontal />
          </Button>
        </MenuDisparador>
        <MenuContenido>
          {enlaces.map((a) => (
            <MenuItem key={a.href + a.etiqueta} asChild>
              <Link href={a.href}>{a.etiqueta}</Link>
            </MenuItem>
          ))}
          {borrar.length > 0 && enlaces.length > 0 && <MenuSeparador />}
          {borrar.map((a) => (
            <MenuItem key={a.etiqueta} peligro onSelect={() => setConfirmando(a.eliminar)} data-testid="menu-eliminar">
              <Trash2 /> {a.etiqueta}
            </MenuItem>
          ))}
        </MenuContenido>
      </Menu>
      {confirmando && (
        <Confirmar
          abierto
          alCambiar={(v) => !v && setConfirmando(null)}
          titulo={confirmando.titulo}
          descripcion={confirmando.descripcion}
          confirmar="Sí, eliminar"
          peligroso
          alConfirmar={async () => {
            const r = await confirmando.accion();
            notificar(r);
            if (r && !r.ok) throw new Error(r.mensaje);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
