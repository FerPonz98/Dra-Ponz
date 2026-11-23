import { urlWhatsApp } from "@/modules/cobros/dominio/mensajes";
import { lineas, pares } from "@/modules/tesis/dominio/landing";

type Textos = { cta: string; ctaCorto: string; mensajeWhatsapp: string; fotoAlt: string; idioma: string };

function IconoWhatsApp() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5 shrink-0 fill-current">
      <path d="M12.04 2a9.9 9.9 0 0 0-8.5 14.98L2 22l5.17-1.5A9.9 9.9 0 1 0 12.04 2Zm0 18.1a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.07.89.9-2.99-.2-.31a8.2 8.2 0 1 1 6.85 3.74Zm4.5-6.14c-.25-.12-1.46-.72-1.69-.8-.23-.08-.39-.12-.55.12-.16.25-.63.8-.78.96-.14.16-.29.18-.53.06a6.7 6.7 0 0 1-3.32-2.9c-.25-.43.25-.4.71-1.33.08-.16.04-.3-.02-.42l-.75-1.8c-.2-.48-.4-.41-.55-.42h-.47a.9.9 0 0 0-.65.3 2.7 2.7 0 0 0-.85 2.02c0 1.19.87 2.34.99 2.5.12.16 1.7 2.6 4.13 3.65 1.53.66 2.13.72 2.9.6.47-.07 1.46-.6 1.66-1.17.2-.58.2-1.07.15-1.17-.06-.1-.22-.16-.47-.28Z" />
    </svg>
  );
}

function BotonWhatsAppLanding({ href, texto, grande }: { href: string; texto: string; grande?: boolean }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center justify-center gap-2 rounded-full bg-[#0b7a3e] font-semibold text-white shadow-sm transition-colors hover:bg-[#096a35] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0b7a3e] ${grande ? "px-6 py-3.5 text-base" : "px-5 py-3 text-sm"}`}
      data-testid="cta-whatsapp"
    >
      <IconoWhatsApp /> {texto}
    </a>
  );
}

function FotoPlaceholder({ alt }: { alt: string }) {
  return (
    <svg role="img" aria-label={alt} viewBox="0 0 240 300" className="h-auto w-full max-w-[240px] rounded-2xl bg-[#f3e8ee]">
      <circle cx="120" cy="115" r="52" fill="#d8b4c8" />
      <path d="M30 300c8-68 46-104 90-104s82 36 90 104Z" fill="#d8b4c8" />
    </svg>
  );
}

function Seccion({ id, titulo, children, fondo }: { id: string; titulo?: string; children: React.ReactNode; fondo?: boolean }) {
  return (
    <section id={id} aria-labelledby={titulo ? `t-${id}` : undefined} className={fondo ? "bg-[#faf5f8]" : undefined}>
      <div className="mx-auto max-w-5xl px-5 py-14 md:py-20">
        {titulo && (
          <h2 id={`t-${id}`} className="mb-8 text-2xl font-bold tracking-tight text-[#4a1736] md:text-3xl">
            {titulo}
          </h2>
        )}
        {children}
      </div>
    </section>
  );
}

export function Landing({ c, t, idioma, whatsapp, fotoUrl }: { c: Record<string, string>; t: Textos; idioma: "es" | "pt"; whatsapp: string; fotoUrl: string | null }) {
  const wa = urlWhatsApp(whatsapp, t.mensajeWhatsapp);
  const testimonios = pares(c["testimonios.items"]);
  return (
    <div lang={idioma} className="pb-20 text-[#1f1720] md:pb-0">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:p-2">
        {idioma === "pt" ? "Ir para o conteúdo" : "Ir al contenido"}
      </a>
      <header className="border-b border-[#eadde4] bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-3">
          <p className="font-semibold text-[#4a1736]">Dra. Julieta Ponz</p>
          <nav aria-label={t.idioma} className="flex items-center gap-1 text-sm">
            {(["es", "pt"] as const).map((l) => (
              <a key={l} href={`/${l}`} hrefLang={l} lang={l} aria-current={l === idioma ? "page" : undefined} className={`rounded px-2 py-1 font-medium ${l === idioma ? "bg-[#7c2d5b] text-white" : "text-[#7c2d5b] hover:underline"}`}>
                {l.toUpperCase()}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main id="contenido">
        {/* 1. Portada */}
        <section className="bg-gradient-to-b from-[#faf5f8] to-white">
          <div className="mx-auto grid max-w-5xl items-center gap-10 px-5 py-12 md:grid-cols-[1fr_240px] md:py-20">
            <div className="space-y-5">
              <h1 className="text-3xl font-bold leading-tight tracking-tight text-[#4a1736] md:text-5xl">{c["portada.titulo"]}</h1>
              <p className="text-lg text-[#4b3a45]">{c["portada.subtitulo"]}</p>
              <p className="text-sm font-medium text-[#6b4a5c]">{c["portada.firma"]}</p>
              <BotonWhatsAppLanding href={wa} texto={t.cta} grande />
            </div>
            <div className="mx-auto">
              {fotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- foto local en /public, tamaño fijo
                <img src={fotoUrl} alt={t.fotoAlt} width={240} height={300} className="h-auto w-full max-w-[240px] rounded-2xl object-cover" fetchPriority="high" />
              ) : (
                <FotoPlaceholder alt={t.fotoAlt} />
              )}
            </div>
          </div>
        </section>

        {/* 2. Cifras */}
        <section aria-label="Cifras" className="border-y border-[#eadde4] bg-white">
          <ul className="mx-auto grid max-w-5xl grid-cols-2 gap-6 px-5 py-10 text-center md:grid-cols-5">
            {pares(c["cifras.items"]).map(([n, txt]) => (
              <li key={txt}>
                <p className="text-3xl font-bold text-[#7c2d5b]">{n}</p>
                <p className="text-sm text-[#4b3a45]">{txt}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* 3. ¿Te pasa esto? */}
        <Seccion id="problemas" titulo={c["problemas.titulo"]}>
          <ul className="grid gap-3 md:grid-cols-2">
            {lineas(c["problemas.items"]).map((x) => (
              <li key={x} className="rounded-xl border border-[#eadde4] bg-white p-4">
                {x}
              </li>
            ))}
          </ul>
          <p className="mt-8 text-xl font-semibold text-[#4a1736]">{c["problemas.cierre"]}</p>
          <div className="mt-6">
            <BotonWhatsAppLanding href={wa} texto={t.cta} />
          </div>
        </Seccion>

        {/* 4. Servicios */}
        <Seccion id="servicios" titulo={c["servicios.titulo"]} fondo>
          <ul className="grid gap-4 md:grid-cols-3">
            {pares(c["servicios.items"]).map(([n, d]) => (
              <li key={n} className="rounded-xl bg-white p-5 shadow-sm">
                <h3 className="text-lg font-semibold text-[#7c2d5b]">{n}</h3>
                <p className="mt-2 text-[#4b3a45]">{d}</p>
              </li>
            ))}
          </ul>
        </Seccion>

        {/* 5. Cómo trabajamos */}
        <Seccion id="proceso" titulo={c["proceso.titulo"]}>
          <ol className="grid gap-4 md:grid-cols-5">
            {lineas(c["proceso.items"]).map((x, i) => (
              <li key={x} className="flex gap-3 md:flex-col">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#7c2d5b] font-bold text-white">{i + 1}</span>
                <span className="pt-1.5 md:pt-0">{x}</span>
              </li>
            ))}
          </ol>
        </Seccion>

        {/* 6. Pago en cuotas (CTA a la mitad) */}
        <Seccion id="pago" titulo={c["pago.titulo"]} fondo>
          <p className="text-lg">{c["pago.texto"]}</p>
          <div className="mt-6">
            <BotonWhatsAppLanding href={wa} texto={t.cta} />
          </div>
        </Seccion>

        {/* 7. Por qué */}
        <Seccion id="porque" titulo={c["porque.titulo"]}>
          <ul className="space-y-3">
            {lineas(c["porque.items"]).map((x) => (
              <li key={x} className="flex gap-3">
                <span aria-hidden className="mt-2 size-2 shrink-0 rounded-full bg-[#7c2d5b]" />
                <span>{x}</span>
              </li>
            ))}
          </ul>
        </Seccion>

        {/* 8. Trayectoria */}
        <Seccion id="trayectoria" titulo={c["trayectoria.titulo"]} fondo>
          <ol className="relative space-y-4 border-l-2 border-[#d8b4c8] pl-6">
            {lineas(c["trayectoria.items"]).map((x) => (
              <li key={x} className="relative">
                <span aria-hidden className="absolute -left-[31px] top-1.5 size-3 rounded-full border-2 border-white bg-[#7c2d5b]" />
                {x}
              </li>
            ))}
          </ol>
        </Seccion>

        {/* 9. Testimonios (solo si hay) */}
        {testimonios.length > 0 && (
          <Seccion id="testimonios" titulo={c["testimonios.titulo"]}>
            <ul className="grid gap-4 md:grid-cols-2">
              {testimonios.map(([texto, autor]) => (
                <li key={texto} className="rounded-xl border border-[#eadde4] p-5">
                  <blockquote>“{texto}”</blockquote>
                  {autor && <p className="mt-2 text-sm font-medium text-[#6b4a5c]">— {autor}</p>}
                </li>
              ))}
            </ul>
          </Seccion>
        )}

        {/* 10. Preguntas frecuentes */}
        <Seccion id="faq" titulo={c["faq.titulo"]}>
          <div className="divide-y divide-[#eadde4] rounded-xl border border-[#eadde4]">
            {pares(c["faq.items"]).map(([p, r]) => (
              <details key={p} className="group p-4">
                <summary className="cursor-pointer list-none font-medium marker:hidden">
                  <span className="mr-2 inline-block text-[#7c2d5b] transition-transform group-open:rotate-90" aria-hidden>
                    ›
                  </span>
                  {p}
                </summary>
                <p className="mt-2 pl-5 text-[#4b3a45]">{r}</p>
              </details>
            ))}
          </div>
        </Seccion>

        {/* 11. Cierre */}
        <section className="bg-[#4a1736] text-white">
          <div className="mx-auto max-w-5xl space-y-6 px-5 py-16 text-center">
            <h2 className="text-2xl font-bold md:text-3xl">{c["cierre.titulo"]}</h2>
            <BotonWhatsAppLanding href={wa} texto={t.cta} grande />
          </div>
        </section>
      </main>

      <footer className="bg-white">
        <p className="mx-auto max-w-5xl px-5 py-6 text-center text-xs text-[#6b4a5c]">© {new Date().getFullYear()} Dra. Elizabeth Julieta Ponz Sejas · Cobija, Pando, Bolivia</p>
      </footer>

      {/* CTA fijo en el celular */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#eadde4] bg-white/95 p-3 backdrop-blur md:hidden">
        <a href={wa} target="_blank" rel="noopener noreferrer" className="flex w-full items-center justify-center gap-2 rounded-full bg-[#0b7a3e] px-4 py-3 font-semibold text-white" data-testid="cta-fijo">
          <IconoWhatsApp /> {t.ctaCorto}
        </a>
      </div>
    </div>
  );
}
