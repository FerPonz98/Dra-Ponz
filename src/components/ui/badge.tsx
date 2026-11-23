import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", {
  variants: {
    variant: {
      default: "bg-primary-soft text-primary ring-primary/20",
      secondary: "bg-muted text-muted-foreground ring-border",
      outline: "bg-transparent text-muted-foreground ring-border-strong",
      exito: "bg-exito-soft text-exito ring-exito/20",
      aviso: "bg-aviso-soft text-aviso ring-aviso/25",
      peligro: "bg-peligro-soft text-peligro ring-peligro/20",
      info: "bg-info-soft text-info ring-info/20",
    },
  },
  defaultVariants: { variant: "default" },
});

export type VarianteBadge = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

/** Etiqueta de estado con punto de color (el texto siempre acompaña al color). */
export function Badge({ className, variant, punto = true, children, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants> & { punto?: boolean }) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {punto && <span aria-hidden className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
