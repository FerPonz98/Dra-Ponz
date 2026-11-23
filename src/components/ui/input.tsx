import * as React from "react";
import { cn } from "@/lib/utils";

const base =
  "flex w-full rounded-lg border border-input bg-surface px-3 py-2 text-[15px] text-foreground shadow-xs transition-[border-color,box-shadow] placeholder:text-subtle-foreground hover:border-subtle-foreground/60 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70 aria-[invalid=true]:border-peligro aria-[invalid=true]:ring-peligro/15 md:text-sm";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        base,
        "h-10 file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-2.5 file:py-1 file:text-sm file:font-medium file:text-foreground",
        props.type === "file" && "h-auto py-1.5",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(base, "min-h-24 leading-relaxed", className)} {...props} />;
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        base,
        "h-10 appearance-none bg-[length:16px] bg-[right_0.6rem_center] bg-no-repeat pr-9",
        "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2378716c' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")]",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-sm font-medium leading-none text-foreground", className)} {...props} />;
}

export function Campo({
  etiqueta,
  error,
  ayuda,
  children,
  htmlFor,
  className,
}: {
  etiqueta: string;
  error?: string;
  ayuda?: string;
  children: React.ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>{etiqueta}</Label>
      {children}
      {ayuda && !error && <p className="text-xs text-muted-foreground">{ayuda}</p>}
      {error && (
        <p className="text-xs font-medium text-peligro" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** Interruptor accesible basado en checkbox. */
export function Interruptor({ id, checked, onChange, etiqueta, descripcion }: { id: string; checked: boolean; onChange: (v: boolean) => void; etiqueta: string; descripcion?: string }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3">
      <span className="relative mt-0.5 inline-flex">
        <input id={id} type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="h-5 w-9 rounded-full bg-border-strong transition-colors peer-checked:bg-primary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring" />
        <span className="absolute left-0.5 top-0.5 size-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-4" />
      </span>
      <span>
        <span className="block text-sm font-medium">{etiqueta}</span>
        {descripcion && <span className="block text-xs text-muted-foreground">{descripcion}</span>}
      </span>
    </label>
  );
}
