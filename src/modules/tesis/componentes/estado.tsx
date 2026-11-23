import { Badge, type VarianteBadge } from "@/components/ui/badge";
import { ETIQUETA_ESTADO } from "@/modules/tesis/dominio/estados";
import type { EstadoProyecto } from "@/modules/tesis/schema";

const VARIANTE: Record<EstadoProyecto, VarianteBadge> = {
  borrador: "secondary",
  enviada: "info",
  vencida: "outline",
  aceptada: "exito",
  en_curso: "exito",
  en_gracia: "aviso",
  en_cola: "peligro",
  tribunal: "default",
  finalizado: "secondary",
};

export function BadgeEstadoProyecto({ estado }: { estado: EstadoProyecto }) {
  return (
    <Badge variant={VARIANTE[estado]} data-testid="estado-proyecto">
      {ETIQUETA_ESTADO[estado]}
    </Badge>
  );
}
