"use client";
import * as T from "@radix-ui/react-tabs";
import * as React from "react";
import { cn } from "@/lib/utils";

export const Pestanas = T.Root;

export function ListaPestanas({ className, ...props }: React.ComponentProps<typeof T.List>) {
  return <T.List className={cn("-mx-1 flex gap-1 overflow-x-auto border-b border-border px-1 [scrollbar-width:none]", className)} {...props} />;
}

export function Pestana({ className, ...props }: React.ComponentProps<typeof T.Trigger>) {
  return (
    <T.Trigger
      className={cn(
        "relative -mb-px inline-flex shrink-0 items-center gap-2 border-b-2 border-transparent px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground [&_svg]:size-4",
        className,
      )}
      {...props}
    />
  );
}

export function PanelPestana({ className, ...props }: React.ComponentProps<typeof T.Content>) {
  return <T.Content className={cn("pt-5 focus-visible:outline-none", className)} {...props} />;
}
