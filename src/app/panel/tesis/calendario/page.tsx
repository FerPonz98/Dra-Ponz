import type { Metadata } from "next";
import { hoyDe, requerirModulo } from "@/core/contexto";
import { EncabezadoPagina } from "@/components/ui/varios";
import { withOrg } from "@/lib/db";
import { Calendario } from "@/modules/tesis/componentes/calendario";
import { COLOR_SITUACION, ETIQUETA_SITUACION, eventosCalendario, type SituacionCobro } from "@/modules/tesis/servicios/calendario";

export const metadata: Metadata = { title: "Calendario" };

export default async function CalendarioPage() {
  const ctx = await requerirModulo("tesis", "tesis:ver");
  const eventos = await withOrg(ctx.organizacion.id, (tx) => eventosCalendario(tx, hoyDe(ctx)));
  const leyenda: [string, string][] = [
    ["Actividad", COLOR_SITUACION.actividad],
    ["Actividad hecha", COLOR_SITUACION.actividad_hecha],
    ...(Object.keys(ETIQUETA_SITUACION) as SituacionCobro[]).map((s) => [`Cobro: ${ETIQUETA_SITUACION[s].toLowerCase()}`, COLOR_SITUACION[s]] as [string, string]),
  ];
  return (
    <div className="space-y-4">
      <EncabezadoPagina ayuda="cronograma-calendario" titulo="Calendario" descripcion="Actividades de los cronogramas y fechas de cobro de tus proyectos. Haz clic en un evento para ver el detalle." />
      <ul className="flex flex-wrap gap-x-4 gap-y-2 rounded-xl border border-border bg-surface px-4 py-3 text-xs text-muted-foreground shadow-xs" aria-label="Leyenda de colores">
        {leyenda.map(([t, c]) => (
          <li key={t} className="flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-full" style={{ background: c }} aria-hidden /> {t}
          </li>
        ))}
      </ul>
      <Calendario eventos={eventos} />
    </div>
  );
}
