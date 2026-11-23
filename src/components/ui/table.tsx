import * as React from "react";
import { cn } from "@/lib/utils";

export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="relative w-full overflow-x-auto">
      <table className={cn("w-full caption-bottom border-separate border-spacing-0 text-sm", className)} {...props} />
    </div>
  );
}
export function THead({ className, ...p }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("sticky top-0 z-10 bg-surface-2/95 backdrop-blur", className)} {...p} />;
}
export function TBody({ className, ...p }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("[&_tr:last-child_td]:border-0", className)} {...p} />;
}
export function TR({ className, ...p }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("transition-colors hover:bg-surface-2/70", className)} {...p} />;
}
export function TH({ className, ...p }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn("h-10 border-b border-border px-3 text-left align-middle text-xs font-medium uppercase tracking-wide text-muted-foreground first:pl-5 last:pr-5", className)} {...p} />;
}
export function TD({ className, ...p }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("border-b border-border px-3 py-3 align-middle first:pl-5 last:pr-5", className)} {...p} />;
}
