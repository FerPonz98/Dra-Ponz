import type { Metadata } from "next";
import { hoyDe, requerirModulo } from "@/core/contexto";
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
    ...(Object.keys(ETIQUETA_SITUACION) as SituacionCobro[]).map((s) => [`Cobro: ${ETIQUETA_SITUACION[s]}`, COLOR_SITUACION[s]] as [string, string]),
  ];
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Calendario</h1>
      <ul className="flex flex-wrap gap-3 text-xs" aria-label="Leyenda de colores">
        {leyenda.map(([t, c]) => (
          <li key={t} className="flex items-center gap-1">
            <span className="inline-block size-3 rounded-sm" style={{ background: c }} aria-hidden /> {t}
          </li>
        ))}
      </ul>
      <Calendario eventos={eventos} />
    </div>
  );
}
