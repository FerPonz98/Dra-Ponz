import { sql } from "drizzle-orm";
import { dbApp } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Health check (Easypanel / HEALTHCHECK del Dockerfile): 200 si la app y la base de datos responden; si no, 503. */
export async function GET() {
  const t0 = performance.now();
  try {
    await Promise.race([dbApp().execute(sql`select 1`), new Promise((_, no) => setTimeout(() => no(new Error("timeout")), 3000))]);
    return Response.json({ ok: true, bd: "ok", ms: Math.round(performance.now() - t0) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    // Sin detalles internos: solo el estado
    return Response.json({ ok: false, bd: "sin respuesta" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
