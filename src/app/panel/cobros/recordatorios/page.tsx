import type { Metadata } from "next";
import Link from "next/link";
import { hoyDe, requerirModulo } from "@/core/contexto";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { withOrg } from "@/lib/db";
import { formatoMoneda } from "@/lib/dinero";
import { formatoFecha } from "@/lib/fechas";
import { BotonWhatsApp } from "@/modules/cobros/componentes/boton-whatsapp";
import { recordatoriosDeHoy, type CategoriaRecordatorio } from "@/modules/cobros/servicios/panel";

export const metadata: Metadata = { title: "Para recordar hoy" };

const TITULOS: Record<CategoriaRecordatorio, string> = {
  vence_en_3_dias: "Vencen en los próximos 3 días",
  vence_hoy: "Vencen hoy",
  vencida: "Vencidas (en gracia)",
  en_cola: "En cola",
};

export default async function RecordatoriosPage() {
  const ctx = await requerirModulo("cobros", "cobros:ver");
  const lista = await withOrg(ctx.organizacion.id, (tx) => recordatoriosDeHoy(tx, hoyDe(ctx)));
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Para recordar hoy</h1>
      <p className="text-sm text-muted-foreground">El botón abre WhatsApp con el mensaje ya escrito: solo revisa y presiona Enviar.</p>
      {(Object.keys(TITULOS) as CategoriaRecordatorio[]).map((cat) => {
        const items = lista.filter((x) => x.categoria === cat);
        return (
          <Card key={cat} data-testid={`grupo-${cat}`}>
            <CardHeader>
              <CardTitle className="text-base">
                {TITULOS[cat]} ({items.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {items.length === 0 && <p className="text-sm text-muted-foreground">Nada por aquí.</p>}
              {items.map((x) => (
                <div key={x.cuotaId} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
                  <span>
                    <strong>{x.cliente.nombre}</strong> · cuota {x.numero} · {formatoMoneda(x.montoCentavos, x.moneda)} · {formatoFecha(x.fecha)}
                    <Link href={`/panel/cobros/planes/${x.plan.id}`} className="block text-xs text-muted-foreground hover:underline">
                      {x.plan.titulo}
                    </Link>
                  </span>
                  <BotonWhatsApp numero={x.cliente.whatsapp} mensaje={x.mensaje} />
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
