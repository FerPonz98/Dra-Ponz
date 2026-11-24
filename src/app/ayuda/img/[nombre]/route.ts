// Capturas de pantalla de los manuales (docs/manual/img). Son de la base de DEMOSTRACIÓN (datos ficticios), por eso
// se sirven sin sesión: también las usa la guía del estudiante. El nombre se valida para que no salga de la carpeta.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { carpetaManual } from "@/lib/manual";
import { nombreImagenValido } from "@/lib/markdown";

const TIPOS: Record<string, string> = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" };

export async function GET(_req: Request, ctx: { params: Promise<{ nombre: string }> }) {
  const { nombre } = await ctx.params;
  if (!nombreImagenValido(nombre)) return new Response("No encontrado", { status: 404 });
  try {
    const datos = await readFile(join(carpetaManual(), "img", nombre));
    return new Response(new Uint8Array(datos), {
      headers: {
        "Content-Type": TIPOS[nombre.split(".").pop()!],
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("No encontrado", { status: 404 });
  }
}
