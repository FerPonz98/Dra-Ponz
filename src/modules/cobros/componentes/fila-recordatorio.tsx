import Link from "next/link";
import { Badge, type VarianteBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/varios";
import { formatoMoneda } from "@/lib/dinero";
import { formatoFecha } from "@/lib/fechas";
import type { CategoriaRecordatorio } from "@/modules/cobros/servicios/panel";
import { BotonWhatsApp } from "./boton-whatsapp";

export const CATEGORIA: Record<CategoriaRecordatorio, { texto: string; v: VarianteBadge }> = {
  vence_en_3_dias: { texto: "Vence pronto", v: "aviso" },
  vence_hoy: { texto: "Vence hoy", v: "aviso" },
  vencida: { texto: "Vencida", v: "peligro" },
  en_cola: { texto: "En cola", v: "peligro" },
};

type Item = {
  categoria: CategoriaRecordatorio;
  cuotaId: string;
  numero: number;
  fecha: string;
  montoCentavos: number;
  moneda: "BOB" | "BRL";
  plan: { id: string; titulo: string };
  cliente: { nombre: string; whatsapp: string | null };
  mensaje: string;
};

/** Fila de "Para recordar hoy": avatar, cliente, cuota, monto, estado y botón de WhatsApp. */
export function FilaRecordatorio({ x }: { x: Item }) {
  const c = CATEGORIA[x.categoria];
  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3 sm:flex sm:px-5">
      <Avatar nombre={x.cliente.nombre} />
      <div className="min-w-0 sm:flex-1">
        <p className="truncate text-sm font-medium">{x.cliente.nombre}</p>
        <Link href={`/panel/cobros/planes/${x.plan.id}`} className="block truncate text-xs text-muted-foreground hover:text-foreground hover:underline">
          Cuota {x.numero} · {x.plan.titulo} · {formatoFecha(x.fecha)}
        </Link>
      </div>
      <p className="text-right text-sm font-semibold tabular-nums sm:order-2 sm:w-28">{formatoMoneda(x.montoCentavos, x.moneda)}</p>
      <div className="col-span-3 flex items-center justify-between gap-3 pl-12 sm:order-3 sm:col-auto sm:pl-0">
        <Badge variant={c.v}>{c.texto}</Badge>
        <BotonWhatsApp numero={x.cliente.whatsapp} mensaje={x.mensaje} />
      </div>
    </li>
  );
}
