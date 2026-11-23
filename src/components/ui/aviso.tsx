import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const ESTILOS = {
  info: { c: "border-info/20 bg-info-soft text-info", I: Info },
  error: { c: "border-peligro/20 bg-peligro-soft text-peligro", I: XCircle },
  exito: { c: "border-exito/20 bg-exito-soft text-exito", I: CheckCircle2 },
  aviso: { c: "border-aviso/25 bg-aviso-soft text-aviso", I: AlertTriangle },
};

export function Aviso({ tipo = "info", titulo, children, className }: { tipo?: keyof typeof ESTILOS; titulo?: string; children: React.ReactNode; className?: string }) {
  const { c, I } = ESTILOS[tipo];
  return (
    <div role={tipo === "error" ? "alert" : "status"} className={cn("flex gap-3 rounded-lg border px-3.5 py-3 text-sm", c, className)}>
      <I className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 text-foreground/90 [&_strong]:text-foreground">
        {titulo && <p className="mb-0.5 font-semibold text-foreground">{titulo}</p>}
        {children}
      </div>
    </div>
  );
}
