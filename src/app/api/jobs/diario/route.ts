import { autorizadoCron } from "@/lib/cron";
import { jobMoraYRecordatorios } from "@/modules/cobros/servicios/jobs";
import { jobTesisDiario } from "@/app/panel/sincronizar";

/** Cron diario 07:00 America/La_Paz: mora, recargos, correos de recordatorio y estados de Tesis. */
export async function POST(req: Request) {
  if (!autorizadoCron(req)) return new Response("No autorizado", { status: 401 });
  const ahora = new Date();
  const cobros = await jobMoraYRecordatorios(ahora);
  const tesis = await jobTesisDiario(ahora);
  return Response.json({ ok: true, fecha: ahora.toISOString(), cobros, tesis });
}
