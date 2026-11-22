export const IDIOMAS = ["es", "pt"] as const;
export type Idioma = (typeof IDIOMAS)[number];
export const esIdioma = (v: string): v is Idioma => (IDIOMAS as readonly string[]).includes(v);
