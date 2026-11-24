import { and, asc, count, eq, inArray, notInArray } from "drizzle-orm";
import { z } from "zod";
import { guardarArchivo, LIMITE_BYTES, prevalidarArchivo, type TipoArchivo } from "@/core/archivos";
import type { Ejecutor } from "@/lib/db";
import { esFechaValida } from "@/lib/fechas";
import { archivosProyecto, formularioCampos, formularios, propuestas, respuestasFormulario, TIPOS_CAMPO, type TipoCampo } from "@/modules/tesis/schema";

export const TIPOS_POR_CAMPO: Partial<Record<TipoCampo, TipoArchivo[]>> = {
  archivo: ["pdf", "word", "excel"],
  zip: ["zip"],
};
/** Paso 4 del portal: archivos sueltos (documentos o ZIP con cualquier otro formato). */
export const TIPOS_SUBIDA_LIBRE: TipoArchivo[] = ["pdf", "word", "excel", "zip"];

export { ETIQUETA_TIPO } from "@/modules/tesis/dominio/campos";

export const esquemaCampo = z
  .object({
    id: z.uuid().optional(),
    tipo: z.enum(TIPOS_CAMPO),
    etiqueta: z.string().trim().min(1, "Cada campo necesita una etiqueta").max(200),
    ayuda: z.string().trim().max(500).default(""),
    obligatorio: z.boolean(),
    opciones: z.array(z.string().trim().min(1).max(120)).max(50).default([]),
  })
  .refine((c) => c.tipo !== "seleccion" || c.opciones.length >= 2, "Una selección necesita al menos 2 opciones");

export const esquemaFormulario = z.object({
  nombre: z.string().trim().min(2, "Escribe un nombre").max(150),
  descripcion: z.string().trim().max(1000).default(""),
  campos: z.array(esquemaCampo).min(1, "Agrega al menos un campo").max(50),
});
export type DatosFormulario = z.input<typeof esquemaFormulario>;

export async function listarFormularios(tx: Ejecutor) {
  const lista = await tx.select().from(formularios).orderBy(asc(formularios.nombre));
  const conteo = lista.length ? await tx.select({ f: formularioCampos.formularioId, n: count() }).from(formularioCampos).where(inArray(formularioCampos.formularioId, lista.map((f) => f.id))).groupBy(formularioCampos.formularioId) : [];
  return lista.map((f) => ({ ...f, campos: conteo.find((c) => c.f === f.id)?.n ?? 0 }));
}

export async function obtenerFormulario(tx: Ejecutor, id: string) {
  const [f] = await tx.select().from(formularios).where(eq(formularios.id, id));
  if (!f) return null;
  const campos = await tx.select().from(formularioCampos).where(eq(formularioCampos.formularioId, id)).orderBy(asc(formularioCampos.orden));
  return { ...f, campos };
}
export type Formulario = NonNullable<Awaited<ReturnType<typeof obtenerFormulario>>>;

/** Crea o actualiza un formulario. Los campos existentes conservan su id (las respuestas guardadas siguen válidas). */
export async function guardarFormulario(tx: Ejecutor, organizacionId: string, entrada: DatosFormulario, id?: string) {
  const d = esquemaFormulario.parse(entrada);
  let formId = id;
  if (formId) {
    const [ok] = await tx.update(formularios).set({ nombre: d.nombre, descripcion: d.descripcion || null }).where(eq(formularios.id, formId)).returning({ id: formularios.id });
    if (!ok) throw new Error("Formulario no encontrado");
  } else {
    const [f] = await tx.insert(formularios).values({ organizacionId, nombre: d.nombre, descripcion: d.descripcion || null }).returning();
    formId = f.id;
  }
  const conservar = d.campos.map((c) => c.id).filter((x): x is string => !!x);
  await tx.delete(formularioCampos).where(and(eq(formularioCampos.formularioId, formId), conservar.length ? notInArray(formularioCampos.id, conservar) : undefined));
  for (const [i, c] of d.campos.entries()) {
    const valores = { tipo: c.tipo, etiqueta: c.etiqueta, ayuda: c.ayuda || null, obligatorio: c.obligatorio, opciones: c.tipo === "seleccion" ? c.opciones : [], orden: i + 1 };
    if (c.id) await tx.update(formularioCampos).set(valores).where(and(eq(formularioCampos.id, c.id), eq(formularioCampos.formularioId, formId)));
    else await tx.insert(formularioCampos).values({ organizacionId, formularioId: formId, ...valores });
  }
  return formId;
}

export type CampoRespuesta = Pick<typeof formularioCampos.$inferSelect, "id" | "tipo" | "etiqueta" | "obligatorio" | "opciones">;

/** Valida las respuestas (texto y archivos) antes de guardar nada. Devuelve errores por campo. */
export function validarRespuestas(campos: CampoRespuesta[], textos: Record<string, string>, archivos: Record<string, { name: string; size: number } | null>): Record<string, string> {
  const errores: Record<string, string> = {};
  for (const c of campos) {
    if (c.tipo === "archivo" || c.tipo === "zip") {
      const f = archivos[c.id];
      if (!f || f.size === 0) {
        if (c.obligatorio) errores[c.id] = "Adjunta el archivo.";
        continue;
      }
      if (f.size > LIMITE_BYTES) errores[c.id] = "El archivo supera el límite de 50 MB.";
      continue;
    }
    const v = (textos[c.id] ?? "").trim();
    if (!v) {
      if (c.obligatorio) errores[c.id] = "Este campo es obligatorio.";
      continue;
    }
    if (c.tipo === "texto_corto" && v.length > 300) errores[c.id] = "Máximo 300 caracteres.";
    if (c.tipo === "texto_largo" && v.length > 10_000) errores[c.id] = "Máximo 10.000 caracteres.";
    if (c.tipo === "fecha" && !esFechaValida(v)) errores[c.id] = "Fecha inválida.";
    if (c.tipo === "seleccion" && !c.opciones.includes(v)) errores[c.id] = "Elige una opción de la lista.";
  }
  return errores;
}

export class ErroresFormulario extends Error {
  constructor(public errores: Record<string, string>) {
    super("Revisa los campos marcados.");
  }
}

/** Guarda las respuestas del estudiante; los archivos van a UPLOAD_DIR y a la lista de archivos del proyecto. */
export async function guardarRespuestas(tx: Ejecutor, d: { organizacionId: string; propuestaId: string; enlaceId: string; fd: FormData }) {
  const [p] = await tx.select().from(propuestas).where(eq(propuestas.id, d.propuestaId));
  if (!p?.formularioId) throw new Error("Esta propuesta no tiene formulario.");
  if (!p.aceptadaEn) throw new Error("Primero acepta la propuesta.");
  const f = await obtenerFormulario(tx, p.formularioId);
  if (!f) throw new Error("Formulario no encontrado.");
  const textos: Record<string, string> = {};
  const archivos: Record<string, File | null> = {};
  for (const c of f.campos) {
    const v = d.fd.get(`campo_${c.id}`);
    if (c.tipo === "archivo" || c.tipo === "zip") archivos[c.id] = v instanceof File && v.size > 0 ? v : null;
    else textos[c.id] = typeof v === "string" ? v : "";
  }
  const errores = validarRespuestas(f.campos, textos, archivos);
  for (const c of f.campos) {
    const a = archivos[c.id];
    if (a && (c.tipo === "archivo" || c.tipo === "zip")) {
      try {
        await prevalidarArchivo(a, TIPOS_POR_CAMPO[c.tipo]!);
      } catch (e) {
        errores[c.id] = e instanceof Error ? e.message : "Archivo inválido";
      }
    }
  }
  if (Object.keys(errores).length) throw new ErroresFormulario(errores);
  const valores: Record<string, unknown> = {};
  for (const c of f.campos) {
    if (c.tipo === "archivo" || c.tipo === "zip") {
      const archivo = archivos[c.id];
      if (!archivo) continue;
      const a = await guardarArchivo(tx, { organizacionId: d.organizacionId, categoria: "tesis", archivo, permitidos: TIPOS_POR_CAMPO[c.tipo]!, enlaceId: d.enlaceId });
      await tx.insert(archivosProyecto).values({ organizacionId: d.organizacionId, propuestaId: d.propuestaId, archivoId: a.id, origen: "formulario", descripcion: c.etiqueta });
      valores[c.etiqueta] = { archivoId: a.id, nombre: a.nombreOriginal };
    } else valores[c.etiqueta] = textos[c.id].trim();
  }
  await tx
    .insert(respuestasFormulario)
    .values({ organizacionId: d.organizacionId, propuestaId: d.propuestaId, formularioId: f.id, valores })
    .onConflictDoUpdate({ target: [respuestasFormulario.propuestaId, respuestasFormulario.formularioId], set: { valores, enviadoEn: new Date() } });
}

/** Paso 4: el estudiante sube archivos (PDF, Word, Excel o ZIP; 50 MB c/u). */
export async function subirArchivosEstudiante(tx: Ejecutor, d: { organizacionId: string; propuestaId: string; enlaceId: string; archivos: File[]; descripcion: string | null }) {
  if (!d.archivos.length) throw new Error("Elige al menos un archivo.");
  if (d.archivos.length > 10) throw new Error("Máximo 10 archivos por envío.");
  for (const archivo of d.archivos) await prevalidarArchivo(archivo, TIPOS_SUBIDA_LIBRE);
  const guardados = [];
  for (const archivo of d.archivos) {
    const a = await guardarArchivo(tx, { organizacionId: d.organizacionId, categoria: "tesis", archivo, permitidos: TIPOS_SUBIDA_LIBRE, enlaceId: d.enlaceId });
    await tx.insert(archivosProyecto).values({ organizacionId: d.organizacionId, propuestaId: d.propuestaId, archivoId: a.id, origen: "estudiante", descripcion: d.descripcion });
    guardados.push(a);
  }
  return guardados;
}

/** Elimina un formulario. Las propuestas que lo usaban quedan «sin formulario» y sus respuestas se borran (los
 *  archivos que el estudiante subió con él siguen en el proyecto). */
export async function eliminarFormulario(tx: Ejecutor, id: string) {
  const borrado = await tx.delete(formularios).where(eq(formularios.id, id)).returning({ id: formularios.id });
  if (!borrado.length) throw new Error("Formulario no encontrado");
}
