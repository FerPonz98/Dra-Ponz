import { Award, BookOpen, CheckCircle2, ChevronDown, Compass, FileQuestion, GraduationCap, Hourglass, LineChart, MessageSquareWarning, Presentation, Quote, ShieldCheck, Sparkles } from "lucide-react";
import { Fraunces } from "next/font/google";
import Image from "next/image";
import { urlWhatsApp } from "@/modules/cobros/dominio/mensajes";
import { lineas, pares } from "@/modules/tesis/dominio/landing";
import { Contador, Revelador } from "./landing-cliente";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap", weight: ["500", "600"] });

type Textos = Record<
  | "cta"
  | "ctaCorto"
  | "mensajeWhatsapp"
  | "fotoAlt"
  | "idioma"
  | "saltar"
  | "navServicios"
  | "navProceso"
  | "navTrayectoria"
  | "navFaq"
  | "cred1"
  | "cred2"
  | "cred3"
  | "etiquetaCifras"
  | "eyebrowServicios"
  | "eyebrowProceso"
  | "eyebrowPorque"
  | "eyebrowTrayectoria"
  | "eyebrowFaq"
  | "respuestaRapida"
  | "niveles"
  | "pie",
  string
>;

function IconoWhatsApp({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`${className} shrink-0 fill-current`}>
      <path d="M12.04 2a9.9 9.9 0 0 0-8.5 14.98L2 22l5.17-1.5A9.9 9.9 0 1 0 12.04 2Zm0 18.1a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.07.89.9-2.99-.2-.31a8.2 8.2 0 1 1 6.85 3.74Zm4.5-6.14c-.25-.12-1.46-.72-1.69-.8-.23-.08-.39-.12-.55.12-.16.25-.63.8-.78.96-.14.16-.29.18-.53.06a6.7 6.7 0 0 1-3.32-2.9c-.25-.43.25-.4.71-1.33.08-.16.04-.3-.02-.42l-.75-1.8c-.2-.48-.4-.41-.55-.42h-.47a.9.9 0 0 0-.65.3 2.7 2.7 0 0 0-.85 2.02c0 1.19.87 2.34.99 2.5.12.16 1.7 2.6 4.13 3.65 1.53.66 2.13.72 2.9.6.47-.07 1.46-.6 1.66-1.17.2-.58.2-1.07.15-1.17-.06-.1-.22-.16-.47-.28Z" />
    </svg>
  );
}

function BotonWhatsApp({ href, texto, variante = "solido" }: { href: string; texto: string; variante?: "solido" | "claro" }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="cta-whatsapp"
      className={
        variante === "claro"
          ? "inline-flex items-center justify-center gap-2.5 rounded-full bg-crema px-7 py-4 text-base font-semibold text-petroleo-oscuro shadow-lg shadow-black/10 transition-all hover:-translate-y-0.5 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-crema"
          : "inline-flex items-center justify-center gap-2.5 rounded-full bg-[#0b7a3e] px-7 py-4 text-base font-semibold text-white shadow-lg shadow-[#0b7a3e]/25 transition-all hover:-translate-y-0.5 hover:bg-[#096a35] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0b7a3e]"
      }
    >
      <IconoWhatsApp /> {texto}
    </a>
  );
}

function Seccion({ id, titulo, eyebrow, children, fondo, centrado }: { id: string; titulo?: string; eyebrow?: string; children: React.ReactNode; fondo?: "crema2" | "blanco"; centrado?: boolean }) {
  return (
    <section id={id} aria-labelledby={titulo ? `t-${id}` : undefined} className={fondo === "crema2" ? "bg-crema-2/70" : fondo === "blanco" ? "bg-white" : undefined}>
      <div className="mx-auto max-w-6xl px-5 py-20 md:py-28">
        {titulo && (
          <div className={`revelar mb-12 max-w-2xl ${centrado ? "mx-auto text-center" : ""}`}>
            {eyebrow && <p className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-dorado-oscuro">{eyebrow}</p>}
            <h2 id={`t-${id}`} className="font-serif text-3xl font-medium leading-tight tracking-tight text-petroleo-oscuro text-balance md:text-[2.75rem]">
              {titulo}
            </h2>
          </div>
        )}
        {children}
      </div>
    </section>
  );
}

const ICONOS_PROBLEMA = [FileQuestion, MessageSquareWarning, LineChart, Hourglass];
const ICONOS_SERVICIO = [GraduationCap, BookOpen, Presentation];

export function Landing({ c, t, idioma, whatsapp, fotoUrl }: { c: Record<string, string>; t: Textos; idioma: "es" | "pt"; whatsapp: string; fotoUrl: string | null }) {
  const wa = urlWhatsApp(whatsapp, t.mensajeWhatsapp);
  const testimonios = pares(c["testimonios.items"]);
  const proceso = lineas(c["proceso.items"]);

  return (
    <div lang={idioma} className={`${fraunces.variable} bg-crema pb-24 text-tinta [color-scheme:light] md:pb-0`}>
      <Revelador />
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-petroleo-oscuro focus:shadow-lg">
        {t.saltar}
      </a>

      <header className="sticky top-0 z-40 border-b border-petroleo/10 bg-crema/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
          <a href={`/${idioma}`} className="font-serif text-lg font-semibold tracking-tight text-petroleo-oscuro">
            Dra. Julieta Ponz
          </a>
          <nav aria-label="Secciones" className="hidden items-center gap-7 text-sm font-medium text-tinta/80 md:flex">
            <a href="#servicios" className="hover:text-petroleo">
              {t.navServicios}
            </a>
            <a href="#proceso" className="hover:text-petroleo">
              {t.navProceso}
            </a>
            <a href="#trayectoria" className="hover:text-petroleo">
              {t.navTrayectoria}
            </a>
            <a href="#faq" className="hover:text-petroleo">
              {t.navFaq}
            </a>
          </nav>
          <nav aria-label={t.idioma} className="flex items-center rounded-full border border-petroleo/20 bg-white/70 p-0.5 text-xs font-semibold">
            {(["es", "pt"] as const).map((l) => (
              <a key={l} href={`/${l}`} hrefLang={l} lang={l} aria-current={l === idioma ? "page" : undefined} className={`rounded-full px-3 py-1.5 transition-colors ${l === idioma ? "bg-petroleo text-white" : "text-petroleo hover:bg-petroleo-claro"}`}>
                {l.toUpperCase()}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main id="contenido">
        {/* 1. Portada */}
        <section className="relative overflow-hidden">
          <div aria-hidden className="absolute -right-40 -top-40 size-[34rem] rounded-full bg-petroleo-claro blur-3xl" />
          <div aria-hidden className="absolute -left-32 bottom-0 size-80 rounded-full bg-[#f1e3c8]/70 blur-3xl" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-12 md:grid-cols-[1.15fr_0.85fr] md:pb-28 md:pt-20">
            <div className="space-y-7">
              <p className="inline-flex items-center gap-2 rounded-full border border-dorado/30 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-dorado-oscuro">
                <Sparkles className="size-3.5" aria-hidden /> {t.niveles}
              </p>
              <h1 className="font-serif text-[2.4rem] font-medium leading-[1.08] tracking-tight text-petroleo-oscuro text-balance md:text-6xl">{c["portada.titulo"]}</h1>
              <p className="max-w-xl text-lg leading-relaxed text-tinta/80">{c["portada.subtitulo"]}</p>
              <div className="flex flex-col items-start gap-3">
                <BotonWhatsApp href={wa} texto={t.cta} />
                <p className="text-xs text-tinta/75">{t.respuestaRapida}</p>
              </div>
              <ul className="flex flex-wrap gap-2 pt-2" aria-label="Credenciales">
                {[
                  [ShieldCheck, t.cred1],
                  [GraduationCap, t.cred2],
                  [Award, t.cred3],
                ].map(([Icono, texto]) => {
                  const I = Icono as typeof Award;
                  return (
                    <li key={texto as string} className="inline-flex items-center gap-1.5 rounded-full border border-petroleo/15 bg-white/80 px-3 py-1.5 text-xs font-medium text-petroleo">
                      <I className="size-3.5 text-dorado-oscuro" aria-hidden /> {texto as string}
                    </li>
                  );
                })}
              </ul>
            </div>
            <figure className="relative mx-auto w-full max-w-[340px]">
              <div aria-hidden className="absolute inset-0 translate-x-4 translate-y-4 rounded-t-full rounded-b-[2rem] border-2 border-dorado/60" />
              <div className="relative aspect-[4/5] overflow-hidden rounded-t-full rounded-b-[2rem] bg-gradient-to-b from-petroleo-claro to-[#cfe0e2] shadow-xl shadow-petroleo/15">
                {fotoUrl ? (
                  <Image src={fotoUrl} alt={t.fotoAlt} fill priority sizes="(min-width: 768px) 340px, 80vw" className="object-cover" />
                ) : (
                  <svg role="img" aria-label={t.fotoAlt} viewBox="0 0 240 300" className="absolute inset-0 size-full">
                    <circle cx="120" cy="128" r="50" fill="#0e4a55" opacity="0.22" />
                    <path d="M26 300c10-74 50-112 94-112s84 38 94 112Z" fill="#0e4a55" opacity="0.22" />
                  </svg>
                )}
              </div>
              <figcaption className="relative -mt-8 ml-auto mr-2 max-w-[15rem] rounded-2xl border border-petroleo/10 bg-white p-4 text-xs leading-relaxed text-tinta/80 shadow-lg">{c["portada.firma"]}</figcaption>
            </figure>
          </div>
        </section>

        {/* 2. Cifras */}
        <section aria-label={t.etiquetaCifras} className="bg-petroleo-oscuro text-crema">
          <ul className="mx-auto grid max-w-6xl grid-cols-2 gap-y-10 px-5 py-14 md:grid-cols-5">
            {pares(c["cifras.items"]).map(([n, txt]) => (
              <li key={txt} className="revelar px-2 text-center">
                <p className="font-serif text-5xl font-medium text-[#e9c98f]">
                  <Contador texto={n} />
                </p>
                <p className="mx-auto mt-2 max-w-[11rem] text-sm leading-snug text-crema/90">{txt}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* 3. ¿Te pasa esto? */}
        <Seccion id="problemas" titulo={c["problemas.titulo"]}>
          <ul className="grid gap-4 sm:grid-cols-2">
            {lineas(c["problemas.items"]).map((x, i) => {
              const I = ICONOS_PROBLEMA[i % ICONOS_PROBLEMA.length];
              return (
                <li key={x} className="revelar flex gap-4 rounded-2xl border border-petroleo/10 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#f6ead4] text-dorado-oscuro">
                    <I className="size-5" aria-hidden />
                  </span>
                  <p className="pt-2 text-[17px] leading-relaxed">{x}</p>
                </li>
              );
            })}
          </ul>
          <div className="revelar mt-12 flex flex-col items-start gap-6 rounded-3xl bg-petroleo-claro p-8 md:flex-row md:items-center md:justify-between">
            <p className="font-serif text-2xl font-medium leading-snug text-petroleo-oscuro md:text-3xl">{c["problemas.cierre"]}</p>
            <BotonWhatsApp href={wa} texto={t.cta} />
          </div>
        </Seccion>

        {/* 4. Servicios */}
        <Seccion id="servicios" titulo={c["servicios.titulo"]} eyebrow={t.eyebrowServicios} fondo="blanco">
          <ul className="grid gap-6 md:grid-cols-3">
            {pares(c["servicios.items"]).map(([n, d], i) => {
              const I = ICONOS_SERVICIO[i % ICONOS_SERVICIO.length];
              return (
                <li key={n} className="revelar group rounded-3xl border border-petroleo/10 bg-crema p-7 transition-all hover:-translate-y-1 hover:border-dorado/40 hover:shadow-xl hover:shadow-petroleo/5">
                  <span className="flex size-12 items-center justify-center rounded-2xl bg-petroleo text-crema transition-transform group-hover:scale-105">
                    <I className="size-6" aria-hidden />
                  </span>
                  <h3 className="mt-6 font-serif text-2xl font-medium text-petroleo-oscuro">{n}</h3>
                  <p className="mt-3 leading-relaxed text-tinta/75">{d}</p>
                </li>
              );
            })}
          </ul>
        </Seccion>

        {/* 5. Cómo trabajamos */}
        <Seccion id="proceso" titulo={c["proceso.titulo"]} eyebrow={t.eyebrowProceso}>
          <ol className="relative grid gap-8 md:grid-cols-5 md:gap-4">
            <span aria-hidden className="absolute left-6 top-6 hidden h-0.5 w-[calc(100%-3rem)] bg-gradient-to-r from-petroleo/40 via-dorado/60 to-petroleo/40 md:block" />
            <span aria-hidden className="absolute bottom-6 left-6 top-6 w-0.5 bg-gradient-to-b from-petroleo/40 via-dorado/60 to-petroleo/40 md:hidden" />
            {proceso.map((x, i) => (
              <li key={x} className="revelar relative flex gap-5 md:flex-col md:gap-4">
                <span className="relative z-10 flex size-12 shrink-0 items-center justify-center rounded-full border-4 border-crema bg-petroleo font-serif text-lg font-semibold text-white shadow-md">{i + 1}</span>
                <p className="pt-3 text-[17px] font-medium leading-snug text-petroleo-oscuro md:pt-0">{x}</p>
              </li>
            ))}
          </ol>
        </Seccion>

        {/* 6. Pago en cuotas (CTA a la mitad) */}
        <section id="pago" aria-labelledby="t-pago" className="px-5">
          <div className="revelar relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-[#f1e3c8] px-8 py-14 md:px-14">
            <div aria-hidden className="absolute -right-16 -top-16 size-64 rounded-full bg-white/40 blur-2xl" />
            <div className="relative grid items-center gap-8 md:grid-cols-[1fr_auto]">
              <div>
                <h2 id="t-pago" className="font-serif text-3xl font-medium text-petroleo-oscuro md:text-4xl">
                  {c["pago.titulo"]}
                </h2>
                <p className="mt-3 max-w-xl text-lg text-tinta/80">{c["pago.texto"]}</p>
              </div>
              <BotonWhatsApp href={wa} texto={t.cta} />
            </div>
          </div>
        </section>

        {/* 7. Por qué */}
        <Seccion id="porque" titulo={c["porque.titulo"]} eyebrow={t.eyebrowPorque}>
          <ul className="grid gap-x-10 gap-y-5 md:grid-cols-2">
            {lineas(c["porque.items"]).map((x) => (
              <li key={x} className="revelar flex gap-3 text-[17px] leading-relaxed">
                <CheckCircle2 className="mt-1 size-5 shrink-0 text-petroleo" aria-hidden />
                <span>{x}</span>
              </li>
            ))}
          </ul>
        </Seccion>

        {/* 8. Trayectoria */}
        <Seccion id="trayectoria" titulo={c["trayectoria.titulo"]} eyebrow={t.eyebrowTrayectoria} fondo="blanco">
          <ol className="relative mx-auto max-w-3xl space-y-7 border-l-2 border-dorado/40 pl-8">
            {lineas(c["trayectoria.items"]).map((x) => (
              <li key={x} className="revelar relative">
                <span aria-hidden className="absolute -left-[41px] top-1 flex size-5 items-center justify-center rounded-full border-2 border-dorado bg-white">
                  <span className="size-2 rounded-full bg-petroleo" />
                </span>
                <p className="text-[17px] leading-relaxed">{x}</p>
              </li>
            ))}
          </ol>
        </Seccion>

        {/* 9. Testimonios (solo si hay) */}
        {testimonios.length > 0 && (
          <Seccion id="testimonios" titulo={c["testimonios.titulo"]}>
            <ul className="grid gap-6 md:grid-cols-2">
              {testimonios.map(([texto, autor]) => (
                <li key={texto} className="revelar rounded-3xl border border-petroleo/10 bg-white p-7 shadow-sm">
                  <Quote className="size-7 text-dorado" aria-hidden />
                  <blockquote className="mt-3 font-serif text-xl leading-relaxed text-petroleo-oscuro">“{texto}”</blockquote>
                  {autor && <p className="mt-4 text-sm font-medium text-tinta/70">— {autor}</p>}
                </li>
              ))}
            </ul>
          </Seccion>
        )}

        {/* 10. Preguntas frecuentes */}
        <Seccion id="faq" titulo={c["faq.titulo"]} eyebrow={t.eyebrowFaq} centrado>
          <div className="mx-auto max-w-3xl space-y-3">
            {pares(c["faq.items"]).map(([p, r]) => (
              <details key={p} className="revelar group rounded-2xl border border-petroleo/10 bg-white open:shadow-md">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 text-left text-[17px] font-medium text-petroleo-oscuro marker:hidden [&::-webkit-details-marker]:hidden">
                  {p}
                  <ChevronDown className="size-5 shrink-0 text-dorado-oscuro transition-transform group-open:rotate-180" aria-hidden />
                </summary>
                <p className="px-5 pb-5 leading-relaxed text-tinta/80">{r}</p>
              </details>
            ))}
          </div>
        </Seccion>

        {/* 11. Cierre */}
        <section className="px-5 pb-20">
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-petroleo-oscuro px-8 py-20 text-center text-crema">
            <div aria-hidden className="absolute -left-20 -top-20 size-72 rounded-full bg-petroleo blur-3xl" />
            <div aria-hidden className="absolute -bottom-24 -right-10 size-72 rounded-full bg-dorado/25 blur-3xl" />
            <div className="relative mx-auto max-w-2xl space-y-8">
              <Compass className="mx-auto size-10 text-[#e9c98f]" aria-hidden />
              <h2 className="font-serif text-3xl font-medium leading-tight md:text-5xl">{c["cierre.titulo"]}</h2>
              <BotonWhatsApp href={wa} texto={t.cta} variante="claro" />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-petroleo/10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-5 py-8 text-center text-sm text-tinta/70 md:flex-row md:text-left">
          <p className="font-serif text-base font-semibold text-petroleo-oscuro">Dra. Elizabeth Julieta Ponz Sejas</p>
          <p>
            {t.pie} · © {new Date().getFullYear()}
          </p>
        </div>
      </footer>

      {/* Botón flotante de WhatsApp (celular) */}
      <a
        href={wa}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="cta-fijo"
        className="fixed bottom-4 left-4 right-4 z-50 flex items-center justify-center gap-2.5 rounded-full bg-[#0b7a3e] px-5 py-3.5 font-semibold text-white shadow-xl shadow-black/20 md:hidden"
      >
        <IconoWhatsApp /> {t.ctaCorto}
      </a>
    </div>
  );
}
