import { Award, BookOpen, CheckCircle2, ChevronDown, Compass, FileQuestion, GraduationCap, Hourglass, LineChart, MessageSquareWarning, Presentation, ShieldCheck, Sparkles } from "lucide-react";
import Image from "next/image";
import type { CSSProperties } from "react";
import { MarcaOrganizacion } from "@/components/marca/marca";
import { clasesFuentes } from "@/components/tema/fuentes";
import { marcaDe, type OrgMarca } from "@/core/marca/marca";
import type { Tema } from "@/core/tema/tema";
import { urlWhatsApp } from "@/modules/cobros/dominio/mensajes";
import { lineas, pares } from "@/modules/tesis/dominio/landing";
import { IntroMarca, SCRIPT_INTRO } from "./intro-marca";
import { Contador, Revelador } from "./landing-cliente";
import { BarraLectura, BotonFlotante, CarruselTestimonios, EncabezadoDinamico, Inclinable, LineaProceso, ProveedorMovimiento } from "./landing-movimiento";

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
  | "pie"
  | "anterior"
  | "siguiente"
  | "testimonio"
  | "de"
  | "saltarIntro",
  string
>;

/** Retraso escalonado para animaciones (CSS var --retraso). */
const retraso = (ms: number) => ({ "--retraso": `${ms}ms` }) as CSSProperties;

function IconoWhatsApp({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`${className} shrink-0 fill-current`}>
      <path d="M12.04 2a9.9 9.9 0 0 0-8.5 14.98L2 22l5.17-1.5A9.9 9.9 0 1 0 12.04 2Zm0 18.1a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.07.89.9-2.99-.2-.31a8.2 8.2 0 1 1 6.85 3.74Zm4.5-6.14c-.25-.12-1.46-.72-1.69-.8-.23-.08-.39-.12-.55.12-.16.25-.63.8-.78.96-.14.16-.29.18-.53.06a6.7 6.7 0 0 1-3.32-2.9c-.25-.43.25-.4.71-1.33.08-.16.04-.3-.02-.42l-.75-1.8c-.2-.48-.4-.41-.55-.42h-.47a.9.9 0 0 0-.65.3 2.7 2.7 0 0 0-.85 2.02c0 1.19.87 2.34.99 2.5.12.16 1.7 2.6 4.13 3.65 1.53.66 2.13.72 2.9.6.47-.07 1.46-.6 1.66-1.17.2-.58.2-1.07.15-1.17-.06-.1-.22-.16-.47-.28Z" />
    </svg>
  );
}

function BotonWhatsApp({ href, texto, variante = "solido", brillo, rebote }: { href: string; texto: string; variante?: "solido" | "claro"; brillo?: boolean; rebote?: boolean }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="cta-whatsapp"
      className={`${rebote ? "rebote" : "boton-vivo"} ${brillo ? "brillo" : ""} inline-flex items-center justify-center gap-2.5 rounded-boton px-7 py-4 text-base font-semibold shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 ${
        variante === "claro"
          ? "bg-tema-sobre-secundario text-tema-secundario shadow-black/10 focus-visible:outline-tema-sobre-secundario"
          : "bg-tema-primario text-tema-sobre-primario shadow-tema-primario/25 hover:bg-tema-primario-hover focus-visible:outline-tema-primario"
      }`}
    >
      <IconoWhatsApp /> {texto}
    </a>
  );
}

function Seccion({ id, titulo, eyebrow, children, fondo, centrado }: { id: string; titulo?: string; eyebrow?: string; children: React.ReactNode; fondo?: "fondo2" | "superficie"; centrado?: boolean }) {
  return (
    <section id={id} aria-labelledby={titulo ? `t-${id}` : undefined} className={fondo === "fondo2" ? "bg-tema-fondo-2" : fondo === "superficie" ? "bg-tema-superficie" : undefined}>
      <div className="mx-auto max-w-6xl px-5 py-20 md:py-28">
        {titulo && (
          <div className={`revelar mb-12 max-w-2xl ${centrado ? "mx-auto text-center" : ""}`}>
            {eyebrow && <p className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-tema-acento-texto">{eyebrow}</p>}
            <h2 id={`t-${id}`} className="font-titulos text-3xl font-medium leading-tight tracking-tight text-tema-titulo text-balance md:text-[2.75rem]">
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

export function Landing({ c, t, idioma, whatsapp, fotoUrl, tema, org, nonce }: { c: Record<string, string>; t: Textos; idioma: "es" | "pt"; whatsapp: string; fotoUrl: string | null; tema: Tema; org: OrgMarca; nonce: string }) {
  // Intro: activada en Apariencia y con el monograma JP (si la organización subió su logo, no se dibuja la J y la P)
  const conIntro = tema.introActiva !== false && marcaDe(org).tipo === "incorporada";
  const wa = urlWhatsApp(whatsapp, t.mensajeWhatsapp);
  const testimonios = pares(c["testimonios.items"]);
  const proceso = lineas(c["proceso.items"]);
  const palabras = c["portada.titulo"].split(/\s+/).filter(Boolean);
  const finTitulo = Math.min(palabras.length * 28, 420);

  return (
    <ProveedorMovimiento>
      <div lang={idioma} className={`landing tema-fuentes ${clasesFuentes(tema)} bg-tema-fondo pb-24 font-texto text-tema-texto [color-scheme:light] md:pb-0`}>
        {conIntro && (
          <>
            {/* Decide ANTES del primer pintado si mostrar la intro (primera visita de la sesión, sin bots ni movimiento reducido) */}
            <script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: SCRIPT_INTRO }} />
            <IntroMarca nombre="Dra. Julieta Ponz" textoSaltar={t.saltarIntro} />
          </>
        )}
        <Revelador />
        <BarraLectura />
        <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-md focus:bg-tema-superficie focus:px-3 focus:py-2 focus:text-tema-titulo focus:shadow-lg">
          {t.saltar}
        </a>

        <EncabezadoDinamico>
          <div className="relative mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
            {/* Logo completo en escritorio; isotipo en el celular (no entra el completo). data-logo-cabecera: destino de la intro. */}
            <a href={`/${idioma}`} aria-label={`${org.nombre} — inicio`} className="flex items-center" data-logo-cabecera>
              <MarcaOrganizacion org={org} cual="logo" conLema={false} className="hidden h-12 w-auto md:block" claseInicial="hidden" />
              <MarcaOrganizacion org={org} cual="isotipo" className="size-10 md:hidden" claseInicial="size-9 text-base md:hidden" />
            </a>
            <nav aria-label="Secciones" className="hidden items-center gap-7 text-sm font-medium text-tema-texto-suave md:flex">
              {(
                [
                  ["#servicios", t.navServicios],
                  ["#proceso", t.navProceso],
                  ["#trayectoria", t.navTrayectoria],
                  ["#faq", t.navFaq],
                ] as const
              ).map(([href, texto]) => (
                <a key={href} href={href} className="enlace-vivo transition-colors hover:text-tema-primario-texto">
                  {texto}
                </a>
              ))}
            </nav>
            <nav aria-label={t.idioma} className="flex items-center rounded-full border border-tema-primario-borde bg-tema-superficie/70 p-0.5 text-xs font-semibold">
              {(["es", "pt"] as const).map((l) => (
                <a
                  key={l}
                  href={`/${l}`}
                  hrefLang={l}
                  lang={l}
                  aria-current={l === idioma ? "page" : undefined}
                  className={`rounded-full px-3 py-1.5 transition-colors ${l === idioma ? "bg-tema-primario text-tema-sobre-primario" : "text-tema-primario-texto hover:bg-tema-primario-suave"}`}
                >
                  {l.toUpperCase()}
                </a>
              ))}
            </nav>
          </div>
        </EncabezadoDinamico>

        <main id="contenido">
          {/* 1. Portada */}
          <section id="portada" className="relative -mt-16 overflow-hidden pt-16">
            <div aria-hidden className="absolute inset-0">
              <div className="mancha mancha-a -right-40 -top-40 size-[34rem] text-tema-primario-suave opacity-90" />
              <div className="mancha mancha-b -left-32 bottom-0 size-80 text-tema-acento-fuerte opacity-70" />
              <div className="mancha mancha-b right-1/3 top-1/2 hidden size-72 text-tema-acento-suave opacity-60 md:block" />
            </div>
            <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-12 md:grid-cols-[1.15fr_0.85fr] md:pb-28 md:pt-20">
              <div className="space-y-7">
                <p className="entrar inline-flex items-center gap-2 rounded-full border border-tema-acento/40 bg-tema-superficie/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-tema-acento-texto">
                  <Sparkles className="size-3.5" aria-hidden /> {t.niveles}
                </p>
                <h1 className="font-titulos text-[2.4rem] font-medium leading-[1.08] tracking-tight text-tema-titulo text-balance md:text-6xl">
                  {palabras.map((p, i) => (
                    <span key={i}>
                      <span className="entrar-palabra" style={retraso(i * 28)}>
                        {p}
                      </span>{" "}
                    </span>
                  ))}
                </h1>
                <p className="entrar max-w-xl text-lg leading-relaxed text-tema-texto-suave" style={retraso(finTitulo)}>
                  {c["portada.subtitulo"]}
                </p>
                {/* El botón de WhatsApp no espera a ninguna animación. */}
                <div className="flex flex-col items-start gap-3">
                  <BotonWhatsApp href={wa} texto={t.cta} brillo />
                  <p className="text-xs text-tema-texto-suave">{t.respuestaRapida}</p>
                </div>
                <ul className="flex flex-wrap gap-2 pt-2" aria-label="Credenciales">
                  {[
                    [ShieldCheck, t.cred1],
                    [GraduationCap, t.cred2],
                    [Award, t.cred3],
                  ].map(([Icono, texto], i) => {
                    const I = Icono as typeof Award;
                    return (
                      <li key={texto as string} className="entrar inline-flex items-center gap-1.5 rounded-full border border-tema-primario-borde bg-tema-superficie/80 px-3 py-1.5 text-xs font-medium text-tema-primario-texto" style={retraso(finTitulo + 150 + i * 120)}>
                        <I className="size-3.5 text-tema-acento-texto" aria-hidden /> {texto as string}
                      </li>
                    );
                  })}
                </ul>
              </div>
              <figure className="entrar-foto relative mx-auto w-full max-w-[340px]">
                <div aria-hidden className="flotar absolute inset-0 rounded-t-full rounded-b-[2rem] border-2 border-tema-acento/60" />
                <div className="relative aspect-[4/5] overflow-hidden rounded-t-full rounded-b-[2rem] bg-gradient-to-b from-tema-primario-suave to-tema-primario-borde shadow-xl shadow-tema-secundario/15">
                  {fotoUrl ? (
                    <Image src={fotoUrl} alt={t.fotoAlt} fill priority sizes="(min-width: 768px) 340px, 80vw" className="object-cover" />
                  ) : (
                    <svg role="img" aria-label={t.fotoAlt} viewBox="0 0 240 300" className="absolute inset-0 size-full text-tema-primario">
                      <circle cx="120" cy="128" r="50" fill="currentColor" opacity="0.22" />
                      <path d="M26 300c10-74 50-112 94-112s84 38 94 112Z" fill="currentColor" opacity="0.22" />
                    </svg>
                  )}
                </div>
                <figcaption className="relative -mt-8 ml-auto mr-2 max-w-[15rem] rounded-tarjeta border border-tema-borde bg-tema-superficie p-4 text-xs leading-relaxed text-tema-texto-suave shadow-lg">{c["portada.firma"]}</figcaption>
              </figure>
            </div>
          </section>

          {/* 2. Cifras */}
          <section aria-label={t.etiquetaCifras} className="bg-tema-secundario text-tema-sobre-secundario">
            <ul className="mx-auto grid max-w-6xl grid-cols-2 gap-y-10 px-5 py-14 md:grid-cols-5">
              {pares(c["cifras.items"]).map(([n, txt], i) => (
                <li key={txt} className="revelar px-2 text-center" style={retraso(i * 90)}>
                  <p className="font-titulos text-5xl font-medium text-tema-acento-sobre-secundario">
                    <Contador texto={n} />
                  </p>
                  <p className="mx-auto mt-2 max-w-[11rem] text-sm leading-snug text-tema-sobre-secundario-suave">{txt}</p>
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
                  <li key={x} className="revelar" style={retraso(i * 100)}>
                    <div className="elevable flex h-full gap-4 rounded-tarjeta border border-tema-borde bg-tema-superficie p-6 shadow-sm">
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-tema-acento-suave text-tema-acento-texto">
                        <I className="size-5" aria-hidden />
                      </span>
                      <p className="pt-2 text-[17px] leading-relaxed">{x}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="revelar mt-12 flex flex-col items-start gap-6 rounded-bloque bg-tema-primario-suave p-8 md:flex-row md:items-center md:justify-between">
              <p className="font-titulos text-2xl font-medium leading-snug text-tema-titulo md:text-3xl">{c["problemas.cierre"]}</p>
              <BotonWhatsApp href={wa} texto={t.cta} />
            </div>
          </Seccion>

          {/* 4. Servicios */}
          <Seccion id="servicios" titulo={c["servicios.titulo"]} eyebrow={t.eyebrowServicios} fondo="superficie">
            <ul className="grid gap-6 md:grid-cols-3">
              {pares(c["servicios.items"]).map(([n, d], i) => {
                const I = ICONOS_SERVICIO[i % ICONOS_SERVICIO.length];
                return (
                  <li key={n} className="revelar" style={retraso(i * 120)}>
                    <Inclinable className="h-full">
                      <div className="elevable group h-full rounded-bloque border border-tema-borde bg-tema-fondo p-7">
                        <span className="flex size-12 items-center justify-center rounded-tarjeta bg-tema-primario text-tema-sobre-primario">
                          <I className="icono-vivo size-6" aria-hidden />
                        </span>
                        <h3 className="mt-6 font-titulos text-2xl font-medium text-tema-titulo">{n}</h3>
                        <p className="mt-3 leading-relaxed text-tema-texto-suave">{d}</p>
                      </div>
                    </Inclinable>
                  </li>
                );
              })}
            </ul>
          </Seccion>

          {/* 5. Cómo trabajamos: la línea se dibuja con el scroll */}
          <Seccion id="proceso" titulo={c["proceso.titulo"]} eyebrow={t.eyebrowProceso}>
            <LineaProceso pasos={proceso} />
          </Seccion>

          {/* 6. Pago en cuotas (CTA a la mitad) */}
          <section id="pago" aria-labelledby="t-pago" className="px-5">
            <div className="revelar relative mx-auto max-w-6xl overflow-hidden rounded-bloque bg-tema-acento-fuerte px-8 py-14 md:px-14">
              <div aria-hidden className="mancha mancha-a -right-16 -top-16 size-64 text-tema-superficie/50" />
              <div className="relative grid items-center gap-8 md:grid-cols-[1fr_auto]">
                <div>
                  <h2 id="t-pago" className="font-titulos text-3xl font-medium text-tema-titulo md:text-4xl">
                    {c["pago.titulo"]}
                  </h2>
                  <p className="mt-3 max-w-xl text-lg text-tema-texto-suave">{c["pago.texto"]}</p>
                </div>
                <BotonWhatsApp href={wa} texto={t.cta} />
              </div>
            </div>
          </section>

          {/* 7. Por qué */}
          <Seccion id="porque" titulo={c["porque.titulo"]} eyebrow={t.eyebrowPorque}>
            <ul className="grid gap-x-10 gap-y-5 md:grid-cols-2">
              {lineas(c["porque.items"]).map((x, i) => (
                <li key={x} className="revelar flex gap-3 text-[17px] leading-relaxed" style={retraso((i % 2) * 90)}>
                  <CheckCircle2 className="mt-1 size-5 shrink-0 text-tema-primario-texto" aria-hidden />
                  <span>{x}</span>
                </li>
              ))}
            </ul>
          </Seccion>

          {/* 8. Trayectoria: hitos alternando izquierda/derecha */}
          <Seccion id="trayectoria" titulo={c["trayectoria.titulo"]} eyebrow={t.eyebrowTrayectoria} fondo="superficie">
            <ol className="relative mx-auto max-w-4xl space-y-7 md:space-y-10">
              <span aria-hidden className="absolute bottom-2 left-[9px] top-2 w-0.5 bg-tema-acento/40 md:left-1/2 md:-translate-x-1/2" />
              {lineas(c["trayectoria.items"]).map((x, i) => {
                const izq = i % 2 === 0;
                return (
                  <li key={x} className={`revelar relative pl-10 md:w-1/2 md:pl-0 ${izq ? "revelar-izq md:pr-12 md:text-right" : "revelar-der md:ml-auto md:pl-12"}`}>
                    <span aria-hidden className={`absolute left-0 top-1 flex size-5 items-center justify-center rounded-full border-2 border-tema-acento bg-tema-superficie ${izq ? "md:left-auto md:-right-2.5" : "md:-left-2.5"}`}>
                      <span className="size-2 rounded-full bg-tema-primario" />
                    </span>
                    <p className="text-[17px] leading-relaxed">{x}</p>
                  </li>
                );
              })}
            </ol>
          </Seccion>

          {/* 9. Testimonios (solo si hay) */}
          {testimonios.length > 0 && (
            <Seccion id="testimonios" titulo={c["testimonios.titulo"]} centrado>
              <div className="revelar">
                <CarruselTestimonios items={testimonios} t={{ anterior: t.anterior, siguiente: t.siguiente, testimonio: t.testimonio, de: t.de }} />
              </div>
            </Seccion>
          )}

          {/* 10. Preguntas frecuentes */}
          <Seccion id="faq" titulo={c["faq.titulo"]} eyebrow={t.eyebrowFaq} centrado>
            <div className="mx-auto max-w-3xl space-y-3">
              {pares(c["faq.items"]).map(([p, r], i) => (
                <details key={p} className="faq revelar group rounded-tarjeta border border-tema-borde bg-tema-superficie transition-shadow open:shadow-md" style={retraso(Math.min(i, 5) * 60)}>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-tarjeta p-5 text-left text-[17px] font-medium text-tema-titulo marker:hidden [&::-webkit-details-marker]:hidden">
                    {p}
                    <ChevronDown className="size-5 shrink-0 text-tema-acento-texto transition-transform duration-300 group-open:rotate-180" aria-hidden />
                  </summary>
                  <p className="respuesta px-5 pb-5 leading-relaxed text-tema-texto-suave">{r}</p>
                </details>
              ))}
            </div>
          </Seccion>

          {/* 11. Cierre con degradado vivo */}
          <section className="px-5 pb-20">
            <div className="relative mx-auto max-w-6xl overflow-hidden rounded-bloque bg-tema-secundario px-8 py-20 text-center text-tema-sobre-secundario">
              <div aria-hidden className="mancha mancha-a -left-20 -top-20 size-72 text-tema-primario opacity-80" />
              <div aria-hidden className="mancha mancha-b -bottom-24 -right-10 size-72 text-tema-acento/30" />
              <div className="revelar relative mx-auto max-w-2xl space-y-8">
                <Compass className="mx-auto size-10 text-tema-acento-sobre-secundario" aria-hidden />
                <h2 className="font-titulos text-3xl font-medium leading-tight md:text-5xl">{c["cierre.titulo"]}</h2>
                <BotonWhatsApp href={wa} texto={t.cta} variante="claro" rebote />
              </div>
            </div>
          </section>
        </main>

        <footer className="border-t border-tema-borde">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-5 py-8 text-center text-sm text-tema-texto-suave md:flex-row md:text-left">
            <div className="flex flex-col items-center gap-3 md:flex-row md:gap-4">
              <MarcaOrganizacion org={org} cual="logo" className="h-16 w-auto" claseInicial="hidden" />
              <p className="font-titulos text-base font-semibold text-tema-titulo">Dra. Elizabeth Julieta Ponz Sejas</p>
            </div>
            <p>
              {t.pie} · © {new Date().getFullYear()}
            </p>
          </div>
        </footer>

        {/* Botón flotante de WhatsApp: aparece después de la portada */}
        <BotonFlotante href={wa}>
          <IconoWhatsApp /> {t.ctaCorto}
        </BotonFlotante>
      </div>
    </ProveedorMovimiento>
  );
}
