import type { EstadoMora } from "@/modules/cobros/schema";
import type { EstadoProyecto } from "@/modules/tesis/schema";

export const ETIQUETA_ESTADO: Record<EstadoProyecto, string> = {
  borrador: "Borrador",
  enviada: "Enviada",
  vencida: "Vencida",
  aceptada: "Aceptada",
  en_curso: "En curso",
  en_gracia: "En gracia",
  en_cola: "En cola",
  tribunal: "Tribunal",
  finalizado: "Finalizado",
};

export const ESTADOS_EDITABLES: EstadoProyecto[] = ["borrador", "enviada", "vencida"];
export const ESTADOS_ACTIVOS: EstadoProyecto[] = ["aceptada", "en_curso", "en_gracia", "en_cola"];

export function calcularExpiracion(enviadaEn: Date, vigenciaDias: number): Date {
  return new Date(enviadaEn.getTime() + vigenciaDias * 86_400_000);
}

/** La propuesta enviada y no aceptada vence al cumplirse su vigencia. */
export function debeVencer(p: { estado: EstadoProyecto; aceptadaEn: Date | null; expiraEn: Date | null }, ahora: Date): boolean {
  return p.estado === "enviada" && !p.aceptadaEn && !!p.expiraEn && p.expiraEn <= ahora;
}

export type EntradaEstado = {
  estado: EstadoProyecto;
  aceptadaEn: Date | null;
  expiraEn: Date | null;
  primeraCuotaPagada: boolean;
  estadoMora: EstadoMora;
  requiereNuevoCronograma: boolean;
  cronogramaAceptadoInicio: string | null;
  hoy: string;
  ahora: Date;
};

/**
 * Máquina de estados del proyecto:
 * borrador → enviada → (vencida ↔ editar/reenviar) → aceptada (1.ª cuota aprobada) → en_curso ↔ en_gracia → en_cola
 * → (paga + nuevo cronograma aceptado) → en_curso → tribunal → finalizado.
 * tribunal y finalizado los marca la asesora a mano.
 */
export function siguienteEstado(e: EntradaEstado): { estado: EstadoProyecto; requiereNuevoCronograma: boolean } {
  let requiere = e.requiereNuevoCronograma;
  if (e.estado === "borrador" || e.estado === "vencida" || e.estado === "tribunal" || e.estado === "finalizado") return { estado: e.estado, requiereNuevoCronograma: requiere };
  if (e.estado === "enviada") {
    if (debeVencer(e, e.ahora)) return { estado: "vencida", requiereNuevoCronograma: requiere };
    if (!e.aceptadaEn || !e.primeraCuotaPagada) return { estado: "enviada", requiereNuevoCronograma: requiere };
  }
  // A partir de aquí el proyecto está aceptado y con la 1.ª cuota aprobada.
  if (e.estadoMora === "en_cola") requiere = true;
  if (requiere) return { estado: "en_cola", requiereNuevoCronograma: true };
  if (e.estadoMora === "vencida") return { estado: "en_gracia", requiereNuevoCronograma: false };
  const empezo = !!e.cronogramaAceptadoInicio && e.cronogramaAceptadoInicio <= e.hoy;
  if (e.estado === "enviada" || (e.estado === "aceptada" && !empezo)) return { estado: "aceptada", requiereNuevoCronograma: false };
  return { estado: "en_curso", requiereNuevoCronograma: false };
}
