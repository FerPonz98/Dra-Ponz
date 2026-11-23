import { mkdir, readFile, writeFile } from "node:fs/promises";
import { isAbsolute, join, normalize, resolve, sep } from "node:path";
import { archivos } from "@/core/db/schema";
import type { Ejecutor } from "@/lib/db";

export const LIMITE_BYTES = 50 * 1024 * 1024; // 50 MB

export type TipoArchivo = "imagen" | "pdf" | "word" | "excel" | "zip";

const FIRMAS = {
  pdf: [[0x25, 0x50, 0x44, 0x46]], // %PDF
  png: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  jpg: [[0xff, 0xd8, 0xff]],
  webp: [[0x52, 0x49, 0x46, 0x46]], // RIFF (+ "WEBP" en el byte 8)
  zip: [
    [0x50, 0x4b, 0x03, 0x04],
    [0x50, 0x4b, 0x05, 0x06], // zip vacío
  ],
  ole: [[0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]], // .doc / .xls
};

type Regla = { tipo: TipoArchivo; mime: string; firmas: number[][]; extra?: (b: Uint8Array) => boolean };
const REGLAS: Record<string, Regla> = {
  pdf: { tipo: "pdf", mime: "application/pdf", firmas: FIRMAS.pdf },
  png: { tipo: "imagen", mime: "image/png", firmas: FIRMAS.png },
  jpg: { tipo: "imagen", mime: "image/jpeg", firmas: FIRMAS.jpg },
  jpeg: { tipo: "imagen", mime: "image/jpeg", firmas: FIRMAS.jpg },
  webp: { tipo: "imagen", mime: "image/webp", firmas: FIRMAS.webp, extra: (b) => String.fromCharCode(...b.slice(8, 12)) === "WEBP" },
  doc: { tipo: "word", mime: "application/msword", firmas: FIRMAS.ole },
  docx: { tipo: "word", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", firmas: FIRMAS.zip },
  xls: { tipo: "excel", mime: "application/vnd.ms-excel", firmas: FIRMAS.ole },
  xlsx: { tipo: "excel", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", firmas: FIRMAS.zip },
  zip: { tipo: "zip", mime: "application/zip", firmas: FIRMAS.zip },
};

export type ResultadoValidacion = { ok: true; extension: string; mime: string; tipo: TipoArchivo } | { ok: false; error: string };

/** Valida tamaño, extensión permitida y que los primeros bytes (magic bytes) coincidan con la extensión. */
export function validarArchivo(nombre: string, tamano: number, inicio: Uint8Array, permitidos: TipoArchivo[]): ResultadoValidacion {
  if (tamano <= 0) return { ok: false, error: "El archivo está vacío." };
  if (tamano > LIMITE_BYTES) return { ok: false, error: "El archivo supera el límite de 50 MB." };
  const extension = nombre.toLowerCase().split(".").pop() ?? "";
  const regla = REGLAS[extension];
  if (!regla || !permitidos.includes(regla.tipo)) {
    return { ok: false, error: `Tipo de archivo no permitido. Se aceptan: ${extensionesDe(permitidos).join(", ")}.` };
  }
  const coincide = regla.firmas.some((f) => f.every((byte, i) => inicio[i] === byte)) && (!regla.extra || regla.extra(inicio));
  if (!coincide) return { ok: false, error: "El contenido del archivo no corresponde a su extensión." };
  return { ok: true, extension, mime: regla.mime, tipo: regla.tipo };
}

export function extensionesDe(tipos: TipoArchivo[]): string[] {
  return Object.entries(REGLAS)
    .filter(([, r]) => tipos.includes(r.tipo))
    .map(([e]) => `.${e}`);
}

export function directorioSubidas() {
  const dir = process.env.UPLOAD_DIR ?? "./.data/uploads";
  return isAbsolute(dir) ? dir : resolve(/*turbopackIgnore: true*/ process.cwd(), dir);
}

/** Valida y guarda un archivo en UPLOAD_DIR/{organizacion_id}/{categoria}/ y registra la fila (con RLS del tx). */
export async function guardarArchivo(
  tx: Ejecutor,
  d: { organizacionId: string; categoria: string; archivo: File; permitidos: TipoArchivo[]; enlaceId?: string | null; subidoPor?: string | null },
) {
  const { archivo } = d;
  if (archivo.size > LIMITE_BYTES) throw new ErrorArchivo("El archivo supera el límite de 50 MB.");
  const bytes = new Uint8Array(await archivo.arrayBuffer());
  const v = validarArchivo(archivo.name, bytes.byteLength, bytes.subarray(0, 16), d.permitidos);
  if (!v.ok) throw new ErrorArchivo(v.error);
  if (!/^[a-z0-9-]+$/.test(d.categoria)) throw new Error("Categoría inválida");
  const id = crypto.randomUUID();
  const relativa = [d.organizacionId, d.categoria, `${id}.${v.extension}`].join("/");
  const destino = rutaSegura(relativa);
  await mkdir(join(destino, ".."), { recursive: true });
  await writeFile(destino, bytes);
  const [fila] = await tx
    .insert(archivos)
    .values({
      id,
      organizacionId: d.organizacionId,
      rutaRelativa: relativa,
      nombreOriginal: archivo.name.slice(0, 200),
      tipoMime: v.mime,
      tamanoBytes: bytes.byteLength,
      categoria: d.categoria,
      enlaceId: d.enlaceId ?? null,
      subidoPor: d.subidoPor ?? null,
    })
    .returning();
  return fila;
}

export async function leerArchivo(rutaRelativa: string) {
  return readFile(rutaSegura(rutaRelativa));
}

function rutaSegura(relativa: string) {
  const raiz = directorioSubidas();
  const destino = normalize(join(/*turbopackIgnore: true*/ raiz, relativa));
  if (!destino.startsWith(normalize(raiz) + sep)) throw new Error("Ruta fuera de UPLOAD_DIR");
  return destino;
}

export class ErrorArchivo extends Error {}

/** Valida un File (tamaño, extensión y magic bytes) sin escribirlo. Lanza ErrorArchivo con el nombre del archivo. */
export async function prevalidarArchivo(archivo: File, permitidos: TipoArchivo[]) {
  const inicio = new Uint8Array(await archivo.slice(0, 16).arrayBuffer());
  const v = validarArchivo(archivo.name, archivo.size, inicio, permitidos);
  if (!v.ok) throw new ErrorArchivo(`${archivo.name}: ${v.error}`);
}
