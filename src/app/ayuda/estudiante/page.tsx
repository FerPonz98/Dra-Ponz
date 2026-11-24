import { FileDown, LifeBuoy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { htmlDeManual } from "@/lib/manual";

export const metadata: Metadata = { title: "Guía del estudiante", robots: { index: false, follow: false } };

const TEXTOS = {
  es: { titulo: "¿Necesitas ayuda?", sub: "Guía rápida para usar tu enlace personal desde el celular.", pdf: "Descargar en PDF", cerrar: "Cuando termines, cierra esta pestaña para volver a tu portal." },
  pt: { titulo: "Precisa de ajuda?", sub: "Guia rápido para usar o seu link pessoal no celular.", pdf: "Baixar em PDF", cerrar: "Quando terminar, feche esta aba para voltar ao seu portal." },
};

export default async function GuiaEstudiantePage(props: { searchParams: Promise<{ idioma?: string }> }) {
  const { idioma: q } = await props.searchParams;
  const idioma = q === "pt" ? "pt" : "es";
  const t = TEXTOS[idioma];
  const { html, titulos } = await htmlDeManual(idioma === "pt" ? "estudiante-pt" : "estudiante-es");
  return (
    <div lang={idioma} className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-surface/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-2xl items-center justify-between gap-3 px-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <LifeBuoy className="size-5 text-primary" aria-hidden /> {t.titulo}
          </p>
          <nav aria-label="Idioma / Idioma" className="inline-flex gap-1 rounded-lg border border-border bg-surface-2 p-1 text-xs font-medium">
            {(["es", "pt"] as const).map((l) => (
              <Link key={l} href={`/ayuda/estudiante?idioma=${l}`} aria-current={l === idioma ? "page" : undefined} className={l === idioma ? "rounded-md bg-surface px-2.5 py-1 shadow-xs" : "rounded-md px-2.5 py-1 text-muted-foreground"}>
                {l === "es" ? "Español" : "Português"}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">
        <p className="mb-4 text-muted-foreground">{t.sub}</p>
        <nav aria-label="Contenido" className="mb-6 rounded-2xl border border-border bg-surface p-4 shadow-xs">
          <ol className="grid gap-1 text-sm sm:grid-cols-2">
            {titulos
              .filter((x) => x.nivel === 2)
              .map((x) => (
                <li key={x.id}>
                  <a href={`#${x.id}`} className="text-primary underline-offset-2 hover:underline">
                    {x.texto}
                  </a>
                </li>
              ))}
          </ol>
        </nav>
        <article className="manual space-y-2 rounded-3xl border border-border bg-surface p-5 shadow-sm sm:p-7 [&_h2]:mt-8 [&_h2:first-child]:mt-0" dangerouslySetInnerHTML={{ __html: html }} />
        <div className="mt-6 flex flex-col items-center gap-3 text-center text-sm text-muted-foreground">
          <a href={`/ayuda/pdf/guia-estudiante-${idioma}.pdf`} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 font-medium text-primary underline underline-offset-2">
            <FileDown className="size-4" aria-hidden /> {t.pdf}
          </a>
          <p>{t.cerrar}</p>
        </div>
      </main>
    </div>
  );
}
