import { AlarmClock, CalendarClock, PartyPopper, PauseCircle, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import { hoyDe, requerirModulo } from "@/core/contexto";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EncabezadoPagina, EstadoVacio } from "@/components/ui/varios";
import { withOrg } from "@/lib/db";
import { FilaRecordatorio } from "@/modules/cobros/componentes/fila-recordatorio";
import { recordatoriosDeHoy, type CategoriaRecordatorio } from "@/modules/cobros/servicios/panel";

export const metadata: Metadata = { title: "Para recordar hoy" };

const GRUPOS: { cat: CategoriaRecordatorio; titulo: string; ayuda: string; Icono: typeof AlarmClock; tono: string }[] = [
  { cat: "vence_en_3_dias", titulo: "Vencen en los próximos 3 días", ayuda: "Un recordatorio amable a tiempo evita atrasos.", Icono: CalendarClock, tono: "bg-info-soft text-info" },
  { cat: "vence_hoy", titulo: "Vencen hoy", ayuda: "Último día para pagar sin atraso.", Icono: AlarmClock, tono: "bg-aviso-soft text-aviso" },
  { cat: "vencida", titulo: "Vencidas (en gracia)", ayuda: "Todavía están dentro de los días de gracia.", Icono: TriangleAlert, tono: "bg-aviso-soft text-aviso" },
  { cat: "en_cola", titulo: "En cola", ayuda: "Superaron la gracia: el plan está en pausa.", Icono: PauseCircle, tono: "bg-peligro-soft text-peligro" },
];

export default async function RecordatoriosPage() {
  const ctx = await requerirModulo("cobros", "cobros:ver");
  const lista = await withOrg(ctx.organizacion.id, (tx) => recordatoriosDeHoy(tx, hoyDe(ctx)));
  return (
    <div className="space-y-6">
      <EncabezadoPagina titulo="Para recordar hoy" descripcion="El botón abre WhatsApp con el mensaje ya escrito: solo revísalo y presiona Enviar." />
      {lista.length === 0 && (
        <Card>
          <EstadoVacio icono={PartyPopper} titulo="Todo al día" descripcion="Hoy no hay cuotas para recordar. ¡Buen trabajo!" />
        </Card>
      )}
      {GRUPOS.map((g) => {
        const items = lista.filter((x) => x.categoria === g.cat);
        if (!items.length && lista.length === 0) return null;
        return (
          <Card key={g.cat} data-testid={`grupo-${g.cat}`}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <span className={`flex size-9 items-center justify-center rounded-lg ${g.tono}`}>
                  <g.Icono className="size-4" aria-hidden />
                </span>
                <div>
                  <CardTitle>
                    {g.titulo} ({items.length})
                  </CardTitle>
                  <CardDescription>{g.ayuda}</CardDescription>
                </div>
              </div>
            </CardHeader>
            {items.length === 0 ? (
              <p className="border-t border-border px-5 py-4 text-sm text-muted-foreground">Nada por aquí.</p>
            ) : (
              <ul className="divide-y divide-border border-t border-border">
                {items.map((x) => (
                  <FilaRecordatorio key={x.cuotaId} x={x} />
                ))}
              </ul>
            )}
          </Card>
        );
      })}
    </div>
  );
}
