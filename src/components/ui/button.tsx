import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-[color,background-color,border-color,box-shadow,transform] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-xs hover:bg-primary-hover",
        destructive: "bg-peligro text-white shadow-xs hover:brightness-110 dark:text-black",
        outline: "border border-border-strong bg-surface text-foreground shadow-xs hover:bg-muted",
        secondary: "bg-muted text-foreground hover:bg-border",
        ghost: "text-foreground hover:bg-muted",
        link: "h-auto px-0 text-primary underline-offset-4 hover:underline",
        whatsapp: "bg-whatsapp text-white shadow-xs hover:bg-whatsapp-hover",
        exito: "bg-exito text-white shadow-xs hover:brightness-110 dark:text-black",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 rounded-md px-3 text-[13px]",
        lg: "h-12 rounded-xl px-6 text-base",
        icon: "size-10",
        "icon-sm": "size-8 rounded-md",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild = false, type, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...(asChild ? {} : { type: type ?? "button" })} {...props} />;
}
export { buttonVariants };
