"use client";
// Animaciones de la landing con Motion. Solo se anima transform y opacity. Las funciones de animación
// de Motion se cargan de forma diferida (LazyMotion), y todo respeta prefers-reduced-motion.
import { LazyMotion, m, useMotionValue, useMotionValueEvent, useReducedMotion, useScroll, useSpring, useTransform } from "motion/react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const cargarFunciones = () => import("./landing-motion-funciones").then((r) => r.default);

export function ProveedorMovimiento({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={cargarFunciones} strict>
      {children}
    </LazyMotion>
  );
}

function useMedia(consulta: string) {
  return useSyncExternalStore(
    (avisar) => {
      const mq = window.matchMedia(consulta);
      mq.addEventListener("change", avisar);
      return () => mq.removeEventListener("change", avisar);
    },
    () => window.matchMedia(consulta).matches,
    () => false,
  );
}

/** Barra fina de progreso de lectura con el color primario. */
export function BarraLectura() {
  const reducido = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const suave = useSpring(scrollYProgress, { stiffness: 220, damping: 40, restDelta: 0.001 });
  return <m.div aria-hidden className="fixed inset-x-0 top-0 z-[60] h-[3px] origin-left bg-tema-primario" style={{ scaleX: reducido ? scrollYProgress : suave }} />;
}

/** Encabezado: transparente arriba, sólido con blur al bajar; se esconde al bajar y aparece al subir. */
export function EncabezadoDinamico({ children }: { children: React.ReactNode }) {
  const reducido = useReducedMotion();
  const { scrollY } = useScroll();
  const [solido, setSolido] = useState(false);
  const [oculto, setOculto] = useState(false);
  const ref = useRef<HTMLElement>(null);
  useMotionValueEvent(scrollY, "change", (y) => {
    const antes = scrollY.getPrevious() ?? 0;
    setSolido(y > 8);
    const conFoco = ref.current?.contains(document.activeElement);
    if (reducido || conFoco || y < 160) setOculto(false);
    else if (Math.abs(y - antes) > 4) setOculto(y > antes);
  });
  return (
    <header
      ref={ref}
      onFocusCapture={() => setOculto(false)}
      data-solido={solido || undefined}
      className={`sticky top-0 z-40 transition-transform duration-300 ease-out ${oculto ? "-translate-y-full" : "translate-y-0"}`}
    >
      <div aria-hidden className={`absolute inset-0 border-b border-tema-borde bg-tema-fondo/85 transition-opacity duration-300 ${solido ? "opacity-100 backdrop-blur-md" : "opacity-0"}`} />
      {children}
    </header>
  );
}

/** "Cómo trabajamos": la línea se dibuja con el scroll y cada paso se ilumina al llegar. */
export function LineaProceso({ pasos }: { pasos: string[] }) {
  const ref = useRef<HTMLOListElement>(null);
  const reducido = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 85%", "end 55%"] });
  const progreso = useSpring(scrollYProgress, { stiffness: 140, damping: 30, restDelta: 0.001 });
  const [activos, setActivos] = useState(pasos.length); // sin JS: todo iluminado
  useMotionValueEvent(scrollYProgress, "change", (p) => {
    if (!reducido) setActivos(Math.min(pasos.length, Math.floor(p * pasos.length + 0.35)));
  });
  const escala = reducido ? 1 : progreso;
  return (
    <ol ref={ref} className="relative grid gap-8 md:grid-cols-5 md:gap-4">
      <span aria-hidden className="absolute left-6 top-6 hidden h-0.5 w-[calc(100%-3rem)] bg-tema-borde md:block" />
      <span aria-hidden className="absolute bottom-6 left-6 top-6 w-0.5 bg-tema-borde md:hidden" />
      <m.span aria-hidden className="absolute left-6 top-6 hidden h-0.5 w-[calc(100%-3rem)] origin-left bg-gradient-to-r from-tema-primario via-tema-acento to-tema-primario md:block" style={{ scaleX: escala }} />
      <m.span aria-hidden className="absolute bottom-6 left-6 top-6 w-0.5 origin-top bg-gradient-to-b from-tema-primario via-tema-acento to-tema-primario md:hidden" style={{ scaleY: escala }} />
      {pasos.map((x, i) => {
        const on = i < activos;
        return (
          <li key={x} className="relative flex gap-5 md:flex-col md:gap-4">
            <span
              className={`relative z-10 flex size-12 shrink-0 items-center justify-center rounded-full border-4 border-tema-fondo font-titulos text-lg font-semibold shadow-md transition-[transform,background-color,color] duration-500 ${
                on ? "scale-100 bg-tema-primario text-tema-sobre-primario" : "scale-90 bg-tema-superficie text-tema-primario-texto"
              }`}
            >
              {i + 1}
            </span>
            <p className={`pt-3 text-[17px] font-medium leading-snug text-tema-titulo transition-opacity duration-500 md:pt-0 ${on ? "opacity-100" : "opacity-60"}`}>{x}</p>
          </li>
        );
      })}
    </ol>
  );
}

/** Inclinación 3D leve al pasar el mouse (solo con puntero fino y sin movimiento reducido). */
export function Inclinable({ children, className }: { children: React.ReactNode; className?: string }) {
  const reducido = useReducedMotion();
  const fino = useMedia("(hover: hover) and (pointer: fine)");
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [5, -5]), { stiffness: 200, damping: 20 });
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-6, 6]), { stiffness: 200, damping: 20 });
  const activo = fino && !reducido;
  return (
    <m.div
      className={className}
      style={activo ? { rotateX, rotateY, transformPerspective: 900 } : undefined}
      onPointerMove={(e) => {
        if (!activo) return;
        const r = e.currentTarget.getBoundingClientRect();
        x.set((e.clientX - r.left) / r.width - 0.5);
        y.set((e.clientY - r.top) / r.height - 0.5);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </m.div>
  );
}

/** Carrusel de testimonios: avance automático suave, pausa al pasar el mouse o con foco, deslizable con el dedo. */
export function CarruselTestimonios({ items, t }: { items: [string, string][]; t: { anterior: string; siguiente: string; testimonio: string; de: string } }) {
  const [i, setI] = useState(0);
  const [pausa, setPausa] = useState(false);
  const reducido = useReducedMotion();
  const inicioX = useRef<number | null>(null);
  const n = items.length;
  const ir = (k: number) => setI(((k % n) + n) % n);
  useEffect(() => {
    if (n < 2 || pausa || reducido) return;
    const id = window.setInterval(() => setI((v) => (v + 1) % n), 6500);
    return () => window.clearInterval(id);
  }, [n, pausa, reducido]);

  return (
    <div
      role="region"
      aria-roledescription="carrusel"
      aria-label={t.testimonio}
      className="relative mx-auto max-w-3xl"
      onMouseEnter={() => setPausa(true)}
      onMouseLeave={() => setPausa(false)}
      onFocusCapture={() => setPausa(true)}
      onBlurCapture={() => setPausa(false)}
    >
      <div
        className="overflow-hidden rounded-bloque"
        onPointerDown={(e) => {
          if (e.pointerType !== "mouse") inicioX.current = e.clientX;
        }}
        onPointerUp={(e) => {
          if (inicioX.current === null) return;
          const dx = e.clientX - inicioX.current;
          inicioX.current = null;
          if (Math.abs(dx) > 40) ir(i + (dx < 0 ? 1 : -1));
        }}
        style={{ touchAction: "pan-y" }}
      >
        <ul className="flex transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]" style={{ transform: `translateX(-${i * 100}%)` }} aria-live={pausa || reducido ? "polite" : "off"}>
          {items.map(([texto, autor], k) => (
            <li key={texto} role="group" aria-roledescription={t.testimonio} aria-label={`${k + 1} ${t.de} ${n}`} aria-hidden={k !== i || undefined} inert={k !== i || undefined} className="w-full shrink-0 px-1">
              <figure className="rounded-bloque border border-tema-borde bg-tema-superficie p-8 shadow-sm md:p-10">
                <svg viewBox="0 0 24 24" aria-hidden className="size-8 fill-current text-tema-acento">
                  <path d="M9.6 6C6.5 7.4 4.5 10 4.5 13.4V18h5.6v-5.6H7.2c.1-2 1.2-3.5 3.3-4.6L9.6 6Zm9 0c-3.1 1.4-5.1 4-5.1 7.4V18h5.6v-5.6h-2.9c.1-2 1.2-3.5 3.3-4.6L18.6 6Z" />
                </svg>
                <blockquote className="mt-4 font-titulos text-xl leading-relaxed text-tema-titulo md:text-2xl">“{texto}”</blockquote>
                {autor && <figcaption className="mt-5 text-sm font-medium text-tema-texto-suave">— {autor}</figcaption>}
              </figure>
            </li>
          ))}
        </ul>
      </div>
      {n > 1 && (
        <div className="mt-6 flex items-center justify-center gap-4">
          <button type="button" onClick={() => ir(i - 1)} aria-label={t.anterior} className="boton-vivo flex size-11 items-center justify-center rounded-full border border-tema-borde bg-tema-superficie text-tema-primario-texto">
            <span aria-hidden>←</span>
          </button>
          <div className="flex gap-2">
            {items.map(([texto], k) => (
              <button key={texto} type="button" onClick={() => ir(k)} aria-label={`${t.testimonio} ${k + 1} ${t.de} ${n}`} aria-current={k === i || undefined} className="flex size-6 items-center justify-center">
                <span className={`block h-2 w-2 rounded-full bg-tema-primario transition-[transform,opacity] duration-300 ${k === i ? "scale-125 opacity-100" : "opacity-30"}`} />
              </button>
            ))}
          </div>
          <button type="button" onClick={() => ir(i + 1)} aria-label={t.siguiente} className="boton-vivo flex size-11 items-center justify-center rounded-full border border-tema-borde bg-tema-superficie text-tema-primario-texto">
            <span aria-hidden>→</span>
          </button>
        </div>
      )}
    </div>
  );
}

/** Botón flotante de WhatsApp: aparece cuando la portada sale de la pantalla. */
export function BotonFlotante({ href, children }: { href: string; children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const portada = document.getElementById("portada");
    if (!portada || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([e]) => setVisible(!e.isIntersecting), { rootMargin: "0px 0px -35% 0px" });
    io.observe(portada);
    return () => io.disconnect();
  }, []);
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="cta-fijo"
      aria-hidden={!visible || undefined}
      tabIndex={visible ? undefined : -1}
      className={`boton-vivo pulso fixed bottom-4 left-4 right-4 z-50 flex items-center justify-center gap-2.5 rounded-boton bg-tema-primario px-5 py-3.5 font-semibold text-tema-sobre-primario shadow-xl shadow-black/20 transition-[opacity,transform,visibility] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] md:left-auto md:right-6 md:bottom-6 md:px-6 ${
        visible ? "visible translate-y-0 opacity-100" : "invisible translate-y-[140%] opacity-0"
      }`}
    >
      {children}
    </a>
  );
}
