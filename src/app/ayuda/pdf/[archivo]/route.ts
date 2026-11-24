// PDF de los manuales (npm run manual:pdf). La guía del estudiante es pública (la abre desde su portal);
// el manual de la Dra. pide sesión del panel.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { obtenerContexto } from "@/core/contexto";
import { carpetaManual } from "@/lib/manual";

const ARCHIVOS: Record<string, { archivo: string; sesion: boolean }> = {
  "manual-dra-ponz.pdf": { archivo: "Manual-Dra-Ponz.pdf", sesion: true },
  "guia-estudiante-es.pdf": { archivo: "Guia-Estudiante-ES.pdf", sesion: false },
  "guia-estudiante-pt.pdf": { archivo: "Guia-Estudiante-PT.pdf", sesion: false },
};

export async function GET(_req: Request, ctx: { params: Promise<{ archivo: string }> }) {
  const { archivo } = await ctx.params;
  const def = Object.hasOwn(ARCHIVOS, archivo) ? ARCHIVOS[archivo] : null;
  if (!def) return new Response("No encontrado", { status: 404 });
  if (def.sesion && !(await obtenerContexto())) return new Response("No encontrado", { status: 404 });
  try {
    const datos = await readFile(join(carpetaManual(), def.archivo));
    return new Response(new Uint8Array(datos), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${def.archivo}"`,
        "Cache-Control": def.sesion ? "private, no-store" : "public, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("No encontrado", { status: 404 });
  }
}
