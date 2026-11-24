import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { EstiloTema } from "@/components/tema/estilo-tema";
import { TEMA_POR_DEFECTO } from "@/core/tema/tema";
import { esIdioma, IDIOMAS } from "@/lib/i18n/idiomas";
import { Landing } from "@/modules/tesis/componentes/landing";
import { datosLanding, organizacionDeLandingCacheada } from "@/modules/tesis/servicios/landing-cache";

type Props = { params: Promise<{ locale: string }> };

const URL_BASE = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const FOTO = "/landing/foto-dra.webp";

async function datos(locale: string) {
  if (!esIdioma(locale)) notFound();
  const org = await organizacionDeLandingCacheada((await headers()).get("host"));
  if (!org) notFound();
  const { contenido: c, tema, marca } = await datosLanding(org.id, locale);
  return { org, c, tema: tema ?? TEMA_POR_DEFECTO, marca, locale };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const { c } = await datos(locale);
  const base = URL_BASE();
  return {
    title: { absolute: c["seo.titulo"] },
    description: c["seo.descripcion"],
    alternates: {
      canonical: `${base}/${locale}`,
      languages: { es: `${base}/es`, pt: `${base}/pt`, "x-default": `${base}/es` },
    },
    openGraph: {
      type: "website",
      url: `${base}/${locale}`,
      title: c["seo.titulo"],
      description: c["seo.descripcion"],
      siteName: "Dra. Julieta Ponz",
      locale: locale === "pt" ? "pt_BR" : "es_BO",
      alternateLocale: locale === "pt" ? ["es_BO"] : ["pt_BR"],
    },
    twitter: { card: "summary_large_image", title: c["seo.titulo"], description: c["seo.descripcion"] },
    robots: { index: true, follow: true },
  };
}

export default async function LandingPage({ params }: Props) {
  const { locale } = await params;
  const { org, c, tema, marca } = await datos(locale);
  const t = await getTranslations({ locale, namespace: "landing" });
  // Foto subida desde el panel (Landing pública); si no hay, la del servidor (public/landing) o el dibujo de reemplazo.
  const fotoSubida = marca?.fotoLandingArchivoId ? `/marca/${org.id}/foto?v=${marca.fotoLandingArchivoId.slice(0, 8)}` : null;
  const hayFoto = !fotoSubida && existsSync(join(/*turbopackIgnore: true*/ process.cwd(), "public", FOTO));
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: "Dra. Elizabeth Julieta Ponz Sejas — Asesoría de tesis",
    url: `${URL_BASE()}/${locale}`,
    areaServed: ["BO", "BR"],
    address: { "@type": "PostalAddress", addressLocality: "Cobija", addressRegion: "Pando", addressCountry: "BO" },
    inLanguage: locale,
    description: c["seo.descripcion"],
  };
  return (
    <>
      <EstiloTema tema={tema} alcance="landing" id={org.id} />
      {/* Transición suave al cambiar ES ↔ PT (View Transitions entre documentos; sin JS). */}
      <style href="landing-transicion" precedence="tema">
        {"@media (prefers-reduced-motion: no-preference){@view-transition{navigation:auto}::view-transition-old(root),::view-transition-new(root){animation-duration:.35s}}"}
      </style>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Landing
        c={c}
        idioma={locale as "es" | "pt"}
        whatsapp={org.whatsapp ?? process.env.WHATSAPP_LANDING ?? ""}
        fotoUrl={fotoSubida ?? (hayFoto ? FOTO : null)}
        tema={tema}
        org={marca}
        nonce={(await headers()).get("x-nonce") ?? ""}
        t={{
          cta: t("cta"),
          ctaCorto: t("ctaCorto"),
          mensajeWhatsapp: t("mensajeWhatsapp"),
          fotoAlt: t("fotoAlt"),
          idioma: t("idioma"),
          saltar: t("saltar"),
          navServicios: t("navServicios"),
          navProceso: t("navProceso"),
          navTrayectoria: t("navTrayectoria"),
          navFaq: t("navFaq"),
          cred1: t("cred1"),
          cred2: t("cred2"),
          cred3: t("cred3"),
          etiquetaCifras: t("etiquetaCifras"),
          eyebrowServicios: t("eyebrowServicios"),
          eyebrowProceso: t("eyebrowProceso"),
          eyebrowPorque: t("eyebrowPorque"),
          eyebrowTrayectoria: t("eyebrowTrayectoria"),
          eyebrowFaq: t("eyebrowFaq"),
          respuestaRapida: t("respuestaRapida"),
          niveles: t("niveles"),
          pie: t("pie"),
          anterior: t("anterior"),
          siguiente: t("siguiente"),
          testimonio: t("testimonio"),
          de: t("de"),
          saltarIntro: t("saltarIntro"),
        }}
      />
    </>
  );
}

export function generateStaticParams() {
  return IDIOMAS.map((locale) => ({ locale }));
}
export const dynamicParams = false;
export const dynamic = "force-dynamic";
