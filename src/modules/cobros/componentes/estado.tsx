import { Badge, type VarianteBadge } from "@/components/ui/badge";
import type { EstadoMora } from "@/modules/cobros/schema";

const MORA: Record<EstadoMora, { texto: string; v: VarianteBadge }> = {
  al_dia: { texto: "Al día", v: "exito" },
  vencida: { texto: "Vencida (en gracia)", v: "aviso" },
  en_cola: { texto: "En cola", v: "peligro" },
};

export function BadgeMora({ estado }: { estado: EstadoMora }) {
  const e = MORA[estado];
  return <Badge variant={e.v}>{e.texto}</Badge>;
}

const PAGO: Record<string, { texto: string; v: VarianteBadge }> = {
  pendiente: { texto: "En revisión", v: "info" },
  aprobado: { texto: "Aprobado", v: "exito" },
  rechazado: { texto: "Rechazado", v: "peligro" },
};
export function BadgePago({ estado }: { estado: string }) {
  const e = PAGO[estado] ?? { texto: estado, v: "outline" as const };
  return <Badge variant={e.v}>{e.texto}</Badge>;
}

export function BadgeCuota({ situacion }: { situacion: "pagada" | "al_dia" | "vencida" | "en_cola" | "en_revision" }) {
  const m: Record<typeof situacion, { texto: string; v: VarianteBadge }> = {
    pagada: { texto: "Pagada", v: "exito" },
    al_dia: { texto: "Pendiente", v: "secondary" },
    vencida: { texto: "Vencida", v: "aviso" },
    en_cola: { texto: "En cola", v: "peligro" },
    en_revision: { texto: "En revisión", v: "info" },
  };
  return <Badge variant={m[situacion].v}>{m[situacion].texto}</Badge>;
}
