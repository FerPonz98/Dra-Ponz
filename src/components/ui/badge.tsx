import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", {
  variants: {
    variant: {
      default: "border-transparent bg-primary text-primary-foreground",
      secondary: "border-transparent bg-secondary text-secondary-foreground",
      outline: "text-foreground",
      exito: "border-transparent bg-emerald-100 text-emerald-800",
      aviso: "border-transparent bg-amber-100 text-amber-900",
      peligro: "border-transparent bg-red-100 text-red-800",
      info: "border-transparent bg-sky-100 text-sky-900",
    },
  },
  defaultVariants: { variant: "default" },
});

export type VarianteBadge = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

export function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
