import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { temaDeOrganizacion } from "@/core/tema/cache";
import { TEMA_POR_DEFECTO } from "@/core/tema/tema";
import { organizacionDeLandingCacheada } from "@/modules/tesis/servicios/landing-cache";

/** manifest.webmanifest: nombre e íconos de la marca, theme_color del tema de la organización del dominio. */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const org = await organizacionDeLandingCacheada((await headers()).get("host")).catch(() => null);
  const tema = (org && (await temaDeOrganizacion(org.id))) || TEMA_POR_DEFECTO;
  const nombre = org?.nombre ?? "Dra. Julieta Ponz";
  return {
    name: `${nombre} — Asesoría de Tesis`,
    short_name: "Julieta Ponz",
    description: "Asesoría de Tesis · Pregrado y Posgrado",
    start_url: "/",
    display: "standalone",
    background_color: tema.colorFondo,
    theme_color: tema.colorPrimario,
    icons: [
      { src: "/brand/android-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/android-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/android-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
