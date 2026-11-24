import { autorizadoCron } from "@/lib/cron";
import { permitir, ipCliente } from "@/lib/seguridad";
import { jobMoraYRecordatorios } from "@/modules/cobros/servicios/jobs";
import { jobTesisDiario } from "@/app/panel/sincronizar";

/** Cron diario 07:00 America/La_Paz: mora, recargos, correos de recordatorio y estados de Tesis. */
export async function POST(req: Request) {
  // 10 por minuto por IP (antes lo frenaba Nginx). Los jobs normales los corre el worker; esto queda para uso manual.
  if (!permitir(`jobs:${ipCliente(req.headers)}`, 10, 60_000)) return new Response("Demasiadas solicitudes", { status: 429 });
  if (!autorizadoCron(req)) return new Response("No autorizado", { status: 401 });
  const ahora = new Date();
  const cobros = await jobMoraYRecordatorios(ahora);
  const tesis = await jobTesisDiario(ahora);
  return Response.json({ ok: true, fecha: ahora.toISOString(), cobros, tesis });
}
