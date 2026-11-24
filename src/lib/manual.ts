// Lectura de los manuales de docs/manual para la ayuda dentro del sistema (solo servidor).
// En producción (standalone/Docker) los archivos viajan gracias a outputFileTracingIncludes (next.config.ts).
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { seccionesMarkdown, renderizarMarkdown } from "./markdown";

export const MANUALES = {
  dra: "Manual-Dra-Ponz.md",
  "estudiante-es": "Guia-Estudiante-ES.md",
  "estudiante-pt": "Guia-Estudiante-PT.md",
} as const;
export type ClaveManual = keyof typeof MANUALES;

export const carpetaManual = () => join(process.cwd(), "docs", "manual");
const rutaImagen = (src: string) => (src.startsWith("img/") ? `/ayuda/img/${src.slice(4)}` : src);

async function leer(clave: ClaveManual) {
  return readFile(join(carpetaManual(), MANUALES[clave]), "utf8");
}

/** Manual dividido en secciones (## …), con las imágenes servidas por /ayuda/img. */
export async function seccionesDeManual(clave: ClaveManual) {
  return seccionesMarkdown(await leer(clave), { imagen: rutaImagen });
}

/** Manual completo en HTML (sin la portada: desde el primer ##). */
export async function htmlDeManual(clave: ClaveManual) {
  const md = await leer(clave);
  const desde = md.search(/^##\s/m);
  return renderizarMarkdown(desde >= 0 ? md.slice(desde) : md, { imagen: rutaImagen });
}
