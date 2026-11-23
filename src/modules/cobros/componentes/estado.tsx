import { Badge, type VarianteBadge } from "@/components/ui/badge";
import type { EstadoMora } from "@/modules/cobros/schema";

export const ETIQUETA_MORA: Record<EstadoMora, { texto: string; v: VarianteBadge }> = {
  al_dia: { texto: "Al día", v: "exito" },
  vencida: { texto: "En gracia", v: "aviso" },
  en_cola: { texto: "En cola", v: "peligro" },
};

export function BadgeMora({ estado }: { estado: EstadoMora }) {
  const e = ETIQUETA_MORA[estado];
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

export type SituacionCuota = "pagada" | "al_dia" | "vencida" | "en_cola" | "en_revision";
export const ETIQUETA_CUOTA: Record<SituacionCuota, { texto: string; v: VarianteBadge }> = {
  pagada: { texto: "Pagada", v: "exito" },
  al_dia: { texto: "Pendiente", v: "secondary" },
  vencida: { texto: "Vencida", v: "aviso" },
  en_cola: { texto: "En cola", v: "peligro" },
  en_revision: { texto: "En revisión", v: "info" },
};
export function BadgeCuota({ situacion }: { situacion: SituacionCuota }) {
  return <Badge variant={ETIQUETA_CUOTA[situacion].v}>{ETIQUETA_CUOTA[situacion].texto}</Badge>;
}
