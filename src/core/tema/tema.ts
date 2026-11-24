// Sistema de temas por organización (puro, sin dependencias de Next): presets, fuentes, validación de
// contraste WCAG AA y generación de variables CSS. Lo usan el servidor (landing, portal, panel) y la
// vista previa en vivo del panel.
import { z } from "zod";
import { ajustarContraste, contraste, esClaro, HEX, luminancia, mezclar, primeroLegible, redondear } from "./colores";

export const FUENTES_TITULOS = [
  { id: "fraunces", nombre: "Fraunces", variable: "--font-fraunces" },
  { id: "lora", nombre: "Lora", variable: "--font-lora" },
  { id: "playfair", nombre: "Playfair Display", variable: "--font-playfair" },
  { id: "source-serif", nombre: "Source Serif", variable: "--font-source-serif" },
] as const;
export const FUENTES_TEXTO = [
  { id: "inter", nombre: "Inter", variable: "--font-inter" },
  { id: "source-sans", nombre: "Source Sans", variable: "--font-source-sans" },
  { id: "nunito-sans", nombre: "Nunito Sans", variable: "--font-nunito-sans" },
  { id: "dm-sans", nombre: "DM Sans", variable: "--font-dm-sans" },
] as const;
export const RADIOS = [
  { id: "recto", nombre: "Recto", boton: "0.375rem", tarjeta: "0.5rem", bloque: "0.75rem" },
  { id: "suave", nombre: "Suave", boton: "0.75rem", tarjeta: "1rem", bloque: "1.5rem" },
  { id: "redondeado", nombre: "Redondeado", boton: "9999px", tarjeta: "1.5rem", bloque: "2rem" },
] as const;

export type FuenteTitulos = (typeof FUENTES_TITULOS)[number]["id"];
export type FuenteTexto = (typeof FUENTES_TEXTO)[number]["id"];
export type RadioBordes = (typeof RADIOS)[number]["id"];

export type Tema = {
  colorPrimario: string;
  colorSecundario: string;
  colorAcento: string;
  colorFondo: string;
  colorTexto: string;
  fuenteTitulos: FuenteTitulos;
  fuenteTexto: FuenteTexto;
  radioBordes: RadioBordes;
  preset: string | null;
  /** Intro animada al entrar a la landing (por defecto sí). */
  introActiva?: boolean;
};
export type CampoColor = "colorPrimario" | "colorSecundario" | "colorAcento" | "colorFondo" | "colorTexto";

type Preset = { id: string; nombre: string; tema: Omit<Tema, "preset" | "introActiva"> };

/** Presets probados: todos cumplen AA (ver tests/unit/tema.test.ts). El primero es el tema actual de la Dra. */
export const PRESETS: Preset[] = [
  {
    id: "academico",
    nombre: "Académico azul petróleo",
    tema: { colorPrimario: "#0e4a55", colorSecundario: "#0a3640", colorAcento: "#b4843a", colorFondo: "#faf6ee", colorTexto: "#1d2a2e", fuenteTitulos: "fraunces", fuenteTexto: "inter", radioBordes: "redondeado" },
  },
  {
    id: "terracota",
    nombre: "Terracota cálido",
    tema: { colorPrimario: "#a2462b", colorSecundario: "#4f2417", colorAcento: "#bb812b", colorFondo: "#fbf5ef", colorTexto: "#2b1d17", fuenteTitulos: "lora", fuenteTexto: "nunito-sans", radioBordes: "suave" },
  },
  {
    id: "bosque",
    nombre: "Verde bosque",
    tema: { colorPrimario: "#2f5d3a", colorSecundario: "#1d3a25", colorAcento: "#a8872f", colorFondo: "#f6f7f1", colorTexto: "#1c2620", fuenteTitulos: "source-serif", fuenteTexto: "source-sans", radioBordes: "suave" },
  },
  {
    id: "vino",
    nombre: "Vino elegante",
    tema: { colorPrimario: "#7a1f3d", colorSecundario: "#451226", colorAcento: "#ab884f", colorFondo: "#fbf7f4", colorTexto: "#2a1a1f", fuenteTitulos: "playfair", fuenteTexto: "source-sans", radioBordes: "redondeado" },
  },
  {
    id: "institucional",
    nombre: "Azul institucional",
    tema: { colorPrimario: "#1d4ed8", colorSecundario: "#172554", colorAcento: "#d97706", colorFondo: "#f8fafc", colorTexto: "#0f172a", fuenteTitulos: "source-serif", fuenteTexto: "inter", radioBordes: "suave" },
  },
  {
    id: "grafito",
    nombre: "Grafito moderno",
    tema: { colorPrimario: "#27272a", colorSecundario: "#18181b", colorAcento: "#6366f1", colorFondo: "#fafafa", colorTexto: "#18181b", fuenteTitulos: "lora", fuenteTexto: "dm-sans", radioBordes: "recto" },
  },
  {
    id: "lavanda",
    nombre: "Lavanda serena",
    tema: { colorPrimario: "#5b3f8c", colorSecundario: "#2e1f4d", colorAcento: "#c0841a", colorFondo: "#faf8fc", colorTexto: "#221a2e", fuenteTitulos: "fraunces", fuenteTexto: "nunito-sans", radioBordes: "redondeado" },
  },
];

export const TEMA_POR_DEFECTO: Tema = { ...PRESETS[0].tema, preset: PRESETS[0].id, introActiva: true };

// ───────────── Variantes derivadas ─────────────

export type Variables = Record<`--${string}`, string>;

/** Genera todas las variantes (hover, suave, borde, texto sobre primario, …) desde los colores base. */
export function derivarColores(t: Pick<Tema, CampoColor>) {
  const { colorPrimario: primario, colorSecundario: secundario, colorAcento: acento, colorFondo: fondo, colorTexto: texto } = t;
  const claro = esClaro(fondo);
  const superficie = claro ? "#ffffff" : mezclar("#ffffff", fondo, 0.07);
  const fondo2 = mezclar(acento, fondo, 0.1);
  const primarioSuave = mezclar(primario, fondo, 0.1);
  const primarioBorde = mezclar(primario, fondo, 0.22);
  const acentoSuave = mezclar(acento, fondo, 0.18);
  const acentoFuerte = mezclar(acento, fondo, 0.28);
  const secundarioSuave = mezclar(secundario, fondo, 0.08);
  const sobrePrimario = primeroLegible(primario, ["#ffffff", texto, fondo]);
  const hoverBase = luminancia(primario) < 0.012 ? mezclar("#ffffff", primario, 0.14) : mezclar("#000000", primario, 0.16);
  const primarioHover = ajustarContraste(hoverBase, [sobrePrimario], 4.5);
  const superficiesClaras = [fondo, superficie, fondo2, primarioSuave, acentoSuave, acentoFuerte, secundarioSuave];
  const primarioTexto = ajustarContraste(primario, [fondo, superficie, primarioSuave], 4.5);
  const titulo = ajustarContraste(secundario, superficiesClaras, 4.5);
  const sobreSecundario = primeroLegible(secundario, [fondo, "#ffffff", texto]);
  const sobreSecundarioSuave = ajustarContraste(mezclar(sobreSecundario, secundario, 0.86), [secundario], 4.5);
  const acentoTexto = ajustarContraste(acento, superficiesClaras, 4.5);
  const acentoSobreSecundario = ajustarContraste(mezclar(acento, sobreSecundario, 0.6), [secundario], 4.5);
  const textoSuave = ajustarContraste(mezclar(texto, fondo, 0.78), superficiesClaras, 4.5);
  const textoFuerte = ajustarContraste(texto, superficiesClaras, 4.5);
  const borde = mezclar(texto, fondo, 0.12);
  const bordeFuerte = mezclar(texto, fondo, 0.22);
  return {
    primario, primarioHover, primarioSuave, primarioBorde, primarioTexto, sobrePrimario,
    secundario, secundarioSuave, sobreSecundario, sobreSecundarioSuave, titulo,
    acento, acentoSuave, acentoFuerte, acentoTexto, acentoSobreSecundario,
    fondo, fondo2, superficie, texto: textoFuerte, textoSuave, borde, bordeFuerte, claro,
  };
}

const pila = (v: string, generica: string) => `var(${v}), ${generica}`;

/** Variables CSS del tema (nombres en español: --color-primario, --color-primario-hover, …). */
export function variablesTema(t: Tema): Variables {
  const c = derivarColores(t);
  const r = RADIOS.find((x) => x.id === t.radioBordes) ?? RADIOS[2];
  const ft = FUENTES_TITULOS.find((f) => f.id === t.fuenteTitulos) ?? FUENTES_TITULOS[0];
  const fx = FUENTES_TEXTO.find((f) => f.id === t.fuenteTexto) ?? FUENTES_TEXTO[0];
  return {
    "--color-primario": c.primario,
    "--color-primario-hover": c.primarioHover,
    "--color-primario-suave": c.primarioSuave,
    "--color-primario-borde": c.primarioBorde,
    "--color-primario-texto": c.primarioTexto,
    "--color-sobre-primario": c.sobrePrimario,
    "--color-secundario": c.secundario,
    "--color-secundario-suave": c.secundarioSuave,
    "--color-sobre-secundario": c.sobreSecundario,
    "--color-sobre-secundario-suave": c.sobreSecundarioSuave,
    "--color-titulo": c.titulo,
    "--color-acento": c.acento,
    "--color-acento-suave": c.acentoSuave,
    "--color-acento-fuerte": c.acentoFuerte,
    "--color-acento-texto": c.acentoTexto,
    "--color-acento-sobre-secundario": c.acentoSobreSecundario,
    "--color-fondo": c.fondo,
    "--color-fondo-2": c.fondo2,
    "--color-superficie": c.superficie,
    "--color-texto": c.texto,
    "--color-texto-suave": c.textoSuave,
    "--color-borde": c.borde,
    "--color-borde-fuerte": c.bordeFuerte,
    "--fuente-titulos": pila(ft.variable, 'ui-serif, Georgia, "Times New Roman", serif'),
    "--fuente-texto": pila(fx.variable, 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'),
    "--radio-boton": r.boton,
    "--radio-tarjeta": r.tarjeta,
    "--radio-bloque": r.bloque,
  };
}

/** Variables de la plataforma (portal y panel) que toman el color de la marca. */
export function variablesPlataforma(t: Tema, alcance: "portal" | "panel"): Variables {
  const c = derivarColores(t);
  const blanco = "#ffffff";
  if (alcance === "panel") {
    // El panel conserva su diseño: solo el primario para acentos (en modo claro).
    const suave = mezclar(t.colorPrimario, blanco, 0.1);
    const primario = ajustarContraste(t.colorPrimario, [blanco, "#fafaf9", "#f5f5f4", suave], 4.5);
    return {
      "--primary": primario,
      "--primary-hover": ajustarContraste(mezclar("#000000", primario, 0.16), [blanco], 4.5),
      "--primary-foreground": primeroLegible(primario, [blanco, "#1c1917"]),
      "--primary-soft": suave,
      "--ring": primario,
      "--marca": primario,
    };
  }
  return {
    "--background": c.fondo,
    "--surface": c.superficie,
    "--surface-2": c.fondo2,
    "--muted": c.fondo2,
    "--foreground": c.texto,
    "--muted-foreground": c.textoSuave,
    "--subtle-foreground": c.textoSuave,
    "--border": c.borde,
    "--border-strong": c.bordeFuerte,
    "--primary": c.primarioTexto,
    "--primary-hover": ajustarContraste(mezclar("#000000", c.primarioTexto, 0.16), [primeroLegible(c.primarioTexto, [blanco, c.texto])], 4.5),
    "--primary-foreground": primeroLegible(c.primarioTexto, [blanco, c.texto, c.fondo]),
    "--primary-soft": c.primarioSuave,
    "--ring": c.primarioTexto,
    "--marca": c.primarioTexto,
    "--radius-3xl": RADIOS.find((x) => x.id === t.radioBordes)?.bloque ?? "1.5rem",
  };
}

const bloque = (selector: string, v: Variables) => `${selector}{${Object.entries(v).map(([k, x]) => `${k}:${x}`).join(";")}}`;

/** CSS listo para inyectar en el <head>. Solo contiene HEX validados y valores de catálogo. */
export function cssTema(t: Tema, alcance: "landing" | "portal" | "panel"): string {
  if (alcance === "panel") return bloque(":root:not(.dark)", variablesPlataforma(t, "panel"));
  const todas = Object.entries(variablesTema(t));
  // Las fuentes se resuelven en .tema-fuentes: ahí están las clases de next/font que definen --font-*.
  const colores = Object.fromEntries(todas.filter(([k]) => !k.startsWith("--fuente-"))) as Variables;
  const fuentes = Object.fromEntries(todas.filter(([k]) => k.startsWith("--fuente-"))) as Variables;
  const base = bloque(":root", colores) + bloque(".tema-fuentes", fuentes);
  return alcance === "portal" ? `${base}${bloque(":root:not(.dark)", variablesPlataforma(t, "portal"))}` : base;
}

// ───────────── Contraste WCAG AA ─────────────

export type Verificacion = {
  id: string;
  etiqueta: string;
  relacion: number;
  minimo: number;
  ok: boolean;
  /** Si no cumple y es bloqueante, no se puede guardar. */
  bloqueante: boolean;
  colores: [string, string];
  sugerencia?: { campo: CampoColor; valor: string; texto: string };
};

export function verificarContraste(t: Pick<Tema, CampoColor>): Verificacion[] {
  const c = derivarColores(t);
  const v = (id: string, etiqueta: string, a: string, b: string, minimo: number, bloqueante: boolean, campo: CampoColor, valor: () => string, texto: string): Verificacion => {
    const relacion = contraste(a, b);
    const ok = relacion >= minimo;
    return { id, etiqueta, relacion: redondear(relacion), minimo, ok, bloqueante, colores: [a, b], sugerencia: ok ? undefined : { campo, valor: valor(), texto } };
  };
  const haciaFondo = c.claro ? "#ffffff" : c.texto;
  return [
    v("texto-fondo", "Texto sobre el fondo", t.colorTexto, t.colorFondo, 4.5, true, "colorTexto", () => ajustarContraste(t.colorTexto, [t.colorFondo], 4.5), "Usa un texto más contrastado"),
    v("boton-texto", "Texto de los botones sobre el primario", c.sobrePrimario, t.colorPrimario, 4.5, true, "colorPrimario", () => ajustarContraste(t.colorPrimario, [haciaFondo], 4.5), "Usa un primario más intenso"),
    v("boton-fondo", "Botones contra el fondo", t.colorPrimario, t.colorFondo, 3, true, "colorPrimario", () => ajustarContraste(t.colorPrimario, [t.colorFondo, haciaFondo], 4.5), "Usa un primario que resalte"),
    v("titulos", "Títulos (secundario) sobre el fondo", t.colorSecundario, t.colorFondo, 4.5, true, "colorSecundario", () => ajustarContraste(t.colorSecundario, [t.colorFondo], 4.5), "Usa un secundario más oscuro"),
    v("franja", "Texto sobre el secundario (cifras y cierre)", c.sobreSecundario, t.colorSecundario, 4.5, true, "colorSecundario", () => ajustarContraste(t.colorSecundario, [t.colorFondo, "#ffffff"], 4.5), "Usa un secundario más profundo"),
    v("acento", "Acento sobre el fondo (íconos y detalles)", t.colorAcento, t.colorFondo, 3, false, "colorAcento", () => ajustarContraste(t.colorAcento, [t.colorFondo], 3), `En textos se usará ${c.acentoTexto}`),
  ];
}

export const bloqueantes = (t: Pick<Tema, CampoColor>) => verificarContraste(t).filter((x) => x.bloqueante && !x.ok);

// ───────────── Validación (servidor) ─────────────

const hex = (nombre: string) => z.string().trim().toLowerCase().regex(HEX, `${nombre}: usa un color HEX como #1a2b3c`);

export const esquemaTema = z
  .object({
    colorPrimario: hex("Primario"),
    colorSecundario: hex("Secundario"),
    colorAcento: hex("Acento"),
    colorFondo: hex("Fondo"),
    colorTexto: hex("Texto"),
    fuenteTitulos: z.enum(FUENTES_TITULOS.map((f) => f.id) as [FuenteTitulos, ...FuenteTitulos[]]),
    fuenteTexto: z.enum(FUENTES_TEXTO.map((f) => f.id) as [FuenteTexto, ...FuenteTexto[]]),
    radioBordes: z.enum(RADIOS.map((r) => r.id) as [RadioBordes, ...RadioBordes[]]),
    preset: z.string().max(40).nullable(),
    introActiva: z.boolean().default(true),
  })
  .superRefine((t, ctx) => {
    // Si algún color no tiene formato HEX, ya hay un error de formato: no se calcula el contraste.
    if (![t.colorPrimario, t.colorSecundario, t.colorAcento, t.colorFondo, t.colorTexto].every((c) => HEX.test(c))) return;
    for (const b of bloqueantes(t)) {
      ctx.addIssue({ code: "custom", path: [b.sugerencia?.campo ?? "colorPrimario"], message: `Contraste insuficiente: ${b.etiqueta} (${b.relacion}:1, mínimo ${b.minimo}:1)` });
    }
  });

/** Preset al que corresponde exactamente el tema (o null si es personalizado). */
export function presetDe(t: Omit<Tema, "preset">): string | null {
  const iguales = (a: Preset["tema"], b: Omit<Tema, "preset">) => (Object.keys(a) as (keyof typeof a)[]).every((k) => String(a[k]).toLowerCase() === String(b[k]).toLowerCase());
  return PRESETS.find((p) => iguales(p.tema, t))?.id ?? null;
}
