export const VARIABLES = ["nombre", "monto", "moneda", "fecha", "enlace", "proyecto"] as const;
export type Variables = Partial<Record<(typeof VARIABLES)[number], string>>;

export const PLANTILLAS_BASE = [
  {
    clave: "enviar_plan",
    titulo: "Enviar propuesta / plan",
    cuerpo: "Hola {nombre}, te comparto tu plan de pagos de {proyecto}. Puedes revisarlo, ver tus cuotas y pagar con QR aquí: {enlace}",
  },
  {
    clave: "recordatorio",
    titulo: "Recordatorio de cuota",
    cuerpo: "Hola {nombre}, te recuerdo que tu cuota de {monto} {moneda} vence el {fecha}. Puedes pagar con QR en: {enlace}",
  },
  {
    clave: "cuota_vencida",
    titulo: "Cuota vencida",
    cuerpo: "Hola {nombre}, tu cuota de {monto} {moneda} venció el {fecha}. Todavía estás dentro del plazo de gracia; puedes pagar aquí: {enlace}",
  },
  {
    clave: "en_cola",
    titulo: "En cola",
    cuerpo: "Hola {nombre}, tu plan de {proyecto} quedó en pausa por una cuota pendiente de {monto} {moneda}. Cuando regularices el pago retomamos: {enlace}",
  },
  {
    clave: "nuevo_cronograma",
    titulo: "Nuevo cronograma",
    cuerpo: "Hola {nombre}, preparé un nuevo cronograma para {proyecto}. Revísalo y acéptalo en tu enlace: {enlace}",
  },
  {
    clave: "pago_aprobado",
    titulo: "Pago aprobado",
    cuerpo: "Hola {nombre}, recibí y aprobé tu pago de {monto} {moneda}. ¡Gracias! Puedes ver tu historial en: {enlace}",
  },
  {
    clave: "propuesta_por_vencer",
    titulo: "Propuesta por vencer",
    cuerpo: "Hola {nombre}, tu propuesta de {proyecto} vence el {fecha}. Si quieres comenzar, acéptala aquí: {enlace}",
  },
] as const;
export type ClavePlantilla = (typeof PLANTILLAS_BASE)[number]["clave"];

/** Reemplaza {variable}; las variables sin valor quedan vacías. */
export function rellenarPlantilla(cuerpo: string, v: Variables): string {
  return cuerpo
    .replace(/\{(\w+)\}/g, (m, k: string) => ((VARIABLES as readonly string[]).includes(k) ? (v[k as keyof Variables] ?? "") : m))
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** Enlace de WhatsApp gratuito (wa.me) con el mensaje ya escrito. */
export function urlWhatsApp(numero: string | null | undefined, texto: string): string {
  const n = (numero ?? "").replace(/\D/g, "");
  return `https://wa.me/${n}?text=${encodeURIComponent(texto)}`;
}
