// Fuentes elegibles del tema (next/font: autoalojadas, sin peticiones a Google en el navegador).
// Inter ya la carga el layout raíz (--font-inter). Solo Fraunces (la del tema por defecto) se precarga;
// las demás se descargan únicamente si el tema las usa.
import { DM_Sans, Fraunces, Lora, Nunito_Sans, Playfair_Display, Source_Sans_3, Source_Serif_4 } from "next/font/google";
import type { FuenteTexto, FuenteTitulos } from "@/core/tema/tema";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap", weight: ["500", "600"] });
const lora = Lora({ subsets: ["latin"], variable: "--font-lora", display: "swap", weight: ["500", "600"], preload: false });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair", display: "swap", weight: ["500", "600"], preload: false });
const sourceSerif = Source_Serif_4({ subsets: ["latin"], variable: "--font-source-serif", display: "swap", weight: ["500", "600"], preload: false });
const sourceSans = Source_Sans_3({ subsets: ["latin"], variable: "--font-source-sans", display: "swap", preload: false });
const nunitoSans = Nunito_Sans({ subsets: ["latin"], variable: "--font-nunito-sans", display: "swap", preload: false });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", display: "swap", preload: false });

const TITULOS: Record<FuenteTitulos, { variable: string }> = { fraunces, lora, playfair, "source-serif": sourceSerif };
const TEXTO: Record<Exclude<FuenteTexto, "inter">, { variable: string }> = { "source-sans": sourceSans, "nunito-sans": nunitoSans, "dm-sans": dmSans };

/** Clases que declaran las variables de las fuentes elegidas (o todas, para la vista previa del panel). */
export function clasesFuentes(elegidas?: { fuenteTitulos: FuenteTitulos; fuenteTexto: FuenteTexto }): string {
  if (!elegidas) return [...Object.values(TITULOS), ...Object.values(TEXTO)].map((f) => f.variable).join(" ");
  const t = TITULOS[elegidas.fuenteTitulos] ?? fraunces;
  const x = elegidas.fuenteTexto === "inter" ? null : TEXTO[elegidas.fuenteTexto];
  return [t.variable, x?.variable].filter(Boolean).join(" ");
}
