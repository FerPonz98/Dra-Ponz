export const TIPOS_CAMPO = ["texto_corto", "texto_largo", "fecha", "seleccion", "archivo", "zip"] as const;
export type TipoCampo = (typeof TIPOS_CAMPO)[number];

export const ETIQUETA_TIPO: Record<TipoCampo, string> = {
  texto_corto: "Texto corto",
  texto_largo: "Texto largo",
  fecha: "Fecha",
  seleccion: "Selección",
  archivo: "Archivo (PDF, Word, Excel)",
  zip: "Archivo ZIP (cualquier otro formato)",
};

export const ACEPTA_POR_TIPO: Partial<Record<TipoCampo, string>> = {
  archivo: ".pdf,.doc,.docx,.xls,.xlsx",
  zip: ".zip",
};
