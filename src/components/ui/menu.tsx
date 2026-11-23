"use client";
import * as DM from "@radix-ui/react-dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

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

/** Menú "⋯" de acciones de una fila (enlaces). */
export function MenuAcciones({ acciones, etiqueta = "Más acciones" }: { acciones: { etiqueta: string; href: string }[]; etiqueta?: string }) {
  if (!acciones.length) return null;
  return (
    <Menu>
      <MenuDisparador asChild>
        <Button variant="ghost" size="icon-sm" aria-label={etiqueta}>
          <MoreHorizontal />
        </Button>
      </MenuDisparador>
      <MenuContenido>
        {acciones.map((a) => (
          <MenuItem key={a.href + a.etiqueta} asChild>
            <Link href={a.href}>{a.etiqueta}</Link>
          </MenuItem>
        ))}
      </MenuContenido>
    </Menu>
  );
}
