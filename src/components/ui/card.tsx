import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-xl border border-border bg-surface text-foreground shadow-xs", className)} {...props} />;
}
export function CardHeader({ className, acciones, children, ...props }: React.HTMLAttributes<HTMLDivElement> & { acciones?: React.ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-1 px-5 pt-5 pb-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4", className)} {...props}>
      <div className="min-w-0 space-y-1">{children}</div>
      {acciones && <div className="flex shrink-0 flex-wrap items-center gap-2">{acciones}</div>}
    </div>
  );
}
export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-[15px] font-semibold leading-6 tracking-tight", className)} {...props} />;
}
export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />;
}
export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 pb-5", className)} {...props} />;
}
export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-wrap items-center gap-2 border-t border-border bg-surface-2/60 px-5 py-3 rounded-b-xl", className)} {...props} />;
}
