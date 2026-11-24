import { autorizadoCron } from "@/lib/cron";
import { permitir, ipCliente } from "@/lib/seguridad";
import { jobTipoCambio } from "@/modules/cobros/servicios/jobs";

/** Cron diario 08:00 America/La_Paz: cotización BRL→BOB del BCB (con respaldo en la última guardada). */
export async function POST(req: Request) {
  // 10 por minuto por IP (antes lo frenaba Nginx). Los jobs normales los corre el worker; esto queda para uso manual.
  if (!permitir(`jobs:${ipCliente(req.headers)}`, 10, 60_000)) return new Response("Demasiadas solicitudes", { status: 429 });
  if (!autorizadoCron(req)) return new Response("No autorizado", { status: 401 });
  const r = await jobTipoCambio();
  return Response.json(r, { status: r.ok ? 200 : 502 });
}
