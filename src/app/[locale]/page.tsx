import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { withOrg } from "@/lib/db";
import { esIdioma, IDIOMAS } from "@/lib/i18n/idiomas";
import { Landing } from "@/modules/tesis/componentes/landing";
import { contenidoLanding, organizacionDeLanding } from "@/modules/tesis/servicios/landing";

type Props = { params: Promise<{ locale: string }> };

const URL_BASE = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const FOTO = "/landing/foto-dra.webp";

async function datos(locale: string) {
  if (!esIdioma(locale)) notFound();
  const org = await organizacionDeLanding((await headers()).get("host"));
  if (!org) notFound();
  const c = await withOrg(org.id, (tx) => contenidoLanding(tx, locale));
  return { org, c, locale };
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
  const { org, c } = await datos(locale);
  const t = await getTranslations({ locale, namespace: "landing" });
  const hayFoto = existsSync(join(/*turbopackIgnore: true*/ process.cwd(), "public", FOTO));
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Landing
        c={c}
        idioma={locale as "es" | "pt"}
        whatsapp={org.whatsapp ?? process.env.WHATSAPP_LANDING ?? ""}
        fotoUrl={hayFoto ? FOTO : null}
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
