import { autorizadoCron } from "@/lib/cron";
import { jobTipoCambio } from "@/modules/cobros/servicios/jobs";

/** Cron diario 08:00 America/La_Paz: cotización BRL→BOB del BCB (con respaldo en la última guardada). */
export async function POST(req: Request) {
  if (!autorizadoCron(req)) return new Response("No autorizado", { status: 401 });
  const r = await jobTipoCambio();
  return Response.json(r, { status: r.ok ? 200 : 502 });
}
