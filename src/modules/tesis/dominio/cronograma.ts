import { z } from "zod";
import { diasEntre, sumarDias, sumarMeses } from "@/lib/fechas";

export type ActividadCronograma = { id?: string; nombre: string; meses: number[]; aCargoEstudiante: boolean; hecha?: boolean };

export const MESES_PLANTILLA = 5;

/** Plantilla por defecto del cronograma (actividades × meses). `meses: "todos"` = cada mes del cronograma. */
export function plantillaCronograma(meses = MESES_PLANTILLA): ActividadCronograma[] {
  const todos = Array.from({ length: meses }, (_, i) => i + 1);
  const m = (n: number) => [Math.min(n, meses)];
  return [
    { nombre: "Revisión bibliográfica", meses: todos, aCargoEstudiante: false },
    { nombre: "Elaboración del perfil de investigación", meses: m(1), aCargoEstudiante: false },
    { nombre: "Elaboración de instrumentos de investigación", meses: m(2), aCargoEstudiante: false },
    { nombre: "Recolección de información primaria", meses: m(2), aCargoEstudiante: true },
    { nombre: "Sistematización de información", meses: m(3), aCargoEstudiante: false },
    { nombre: "Análisis e interpretación de datos", meses: m(3), aCargoEstudiante: false },
    { nombre: "Elaboración del primer borrador", meses: m(4), aCargoEstudiante: false },
    { nombre: "Correcciones del tribunal — 2 revisiones", meses: m(5), aCargoEstudiante: false },
    { nombre: "Defensa de la tesis", meses: m(5), aCargoEstudiante: true },
  ];
}

export const esquemaActividad = z.object({
  id: z.uuid().optional(),
  nombre: z.string().trim().min(2, "Nombre de actividad muy corto").max(200),
  meses: z.array(z.number().int().min(1).max(36)).min(1, "Cada actividad necesita al menos un mes"),
  aCargoEstudiante: z.boolean(),
  hecha: z.boolean().optional(),
});

export const esquemaCronograma = z
  .object({
    fechaInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha de inicio inválida"),
    meses: z.number().int().min(1).max(36),
    actividades: z.array(esquemaActividad).min(1, "Agrega al menos una actividad").max(60),
  })
  .refine((c) => c.actividades.every((a) => a.meses.every((m) => m <= c.meses)), "Hay actividades en meses fuera del cronograma");
export type DatosCronograma = z.infer<typeof esquemaCronograma>;

/** Rango de fechas del mes N del cronograma (N empieza en 1). */
export function rangoMes(fechaInicio: string, n: number): { desde: string; hasta: string } {
  const desde = sumarMeses(fechaInicio, n - 1);
  return { desde, hasta: sumarDias(sumarMeses(fechaInicio, n), -1) };
}

/** Mes del cronograma en curso para `hoy` (0 si aún no empieza; > meses si ya terminó). */
export function mesActual(fechaInicio: string, hoy: string, meses: number): number {
  if (diasEntre(fechaInicio, hoy) < 0) return 0;
  for (let n = 1; n <= meses; n++) if (hoy <= rangoMes(fechaInicio, n).hasta) return n;
  return meses + 1;
}

/** Avance % = actividades hechas / total. */
export function avance(actividades: Pick<ActividadCronograma, "hecha">[]): number {
  if (!actividades.length) return 0;
  return Math.round((actividades.filter((a) => a.hecha).length / actividades.length) * 100);
}
