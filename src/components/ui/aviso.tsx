import { cn } from "@/lib/utils";

export function Aviso({
  tipo = "info",
  children,
  className,
}: {
  tipo?: "info" | "error" | "exito" | "aviso";
  children: React.ReactNode;
  className?: string;
}) {
  const estilos = {
    info: "border-sky-200 bg-sky-50 text-sky-900",
    error: "border-red-200 bg-red-50 text-red-900",
    exito: "border-emerald-200 bg-emerald-50 text-emerald-900",
    aviso: "border-amber-200 bg-amber-50 text-amber-900",
  }[tipo];
  return (
    <div role={tipo === "error" ? "alert" : "status"} className={cn("rounded-md border px-3 py-2 text-sm", estilos, className)}>
      {children}
    </div>
  );
}
