"use client";
// Intro de marca al entrar a la landing: el monograma se dibuja trazo a trazo, aparece el nombre con una línea dorada,
// el telón sube y el monograma "vuela" a su lugar en el encabezado (FLIP: misma técnica que layoutId de Motion).
// - La capa está oculta por defecto: solo se muestra si el script en línea (SCRIPT_INTRO) agregó .con-intro a <html>
//   antes del primer pintado (primera visita de la sesión, sin movimiento reducido, sin bots). Sin JS, nunca aparece.
// - La portada se renderiza debajo, en el servidor: no se bloquea el LCP ni el SEO. Solo transform y opacity.
// - Se salta con el botón, Esc, un clic, un toque, la rueda o una tecla. Máx. 2,2 s (celular ≤ 1,6 s).
import { useEffect, useRef } from "react";
import { D_J, D_P, D_RASGO, VIEWBOX_ISOTIPO } from "@/components/marca/trazos";

export const CLAVE_INTRO = "jp-intro";

/** Corre en línea antes de la capa (con nonce). Decide si mostrar la intro y lo marca en la sesión. */
export const SCRIPT_INTRO = `(function(){try{var d=document.documentElement,n=navigator.userAgent||"";
if(!window.matchMedia||matchMedia("(prefers-reduced-motion: reduce)").matches)return;
if(/bot|crawl|spider|slurp|facebookexternalhit|facebot|whatsapp|telegram|twitter|linkedin|embedly|preview|pinterest|discord|skype|headless(?!chrome)/i.test(n))return;
if(sessionStorage.getItem("${CLAVE_INTRO}"))return;sessionStorage.setItem("${CLAVE_INTRO}","1");
d.classList.add("con-intro");window.__introInicio=performance.now();if(innerWidth<768)d.classList.add("intro-corta")}catch(e){}})();`;

const FACIL = "cubic-bezier(0.22, 1, 0.36, 1)";

export function IntroMarca({ nombre, textoSaltar }: { nombre: string; textoSaltar: string }) {
  const capa = useRef<HTMLDivElement>(null);
  const simbolo = useRef<HTMLDivElement>(null);
  const terminada = useRef(false);
  const saltarRef = useRef<() => void>(() => {});

  useEffect(() => {
    const raiz = document.documentElement;
    if (!raiz.classList.contains("con-intro")) return;
    const corta = raiz.classList.contains("intro-corta");
    const k = corta ? 0.72 : 1; // celular: ≤ 1,6 s
    const fin = () => {
      if (terminada.current) return;
      terminada.current = true;
      raiz.classList.remove("con-intro", "intro-corta");
      quitarEscuchas();
    };

    // Salida: el telón sube y el monograma vuela hasta el logo del encabezado
    const salir = (rapido: boolean) => {
      if (terminada.current || !capa.current || !simbolo.current) return;
      clearTimeout(temporizador);
      const dur = rapido ? 260 : 650 * k;
      const fondo = capa.current.querySelector<HTMLElement>("[data-intro-fondo]")!;
      const texto = capa.current.querySelector<HTMLElement>("[data-intro-texto]")!;
      capa.current.querySelector<HTMLElement>(".intro-saltar")?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: "forwards" });
      texto.animate([{ opacity: 1 }, { opacity: 0 }], { duration: Math.min(dur, 300), fill: "forwards" });
      fondo.animate([{ transform: "translateY(0)" }, { transform: "translateY(-100%)" }], { duration: dur, easing: FACIL, fill: "forwards" });
      const destino = destinoLogo();
      const origen = simbolo.current.getBoundingClientRect();
      if (destino && !rapido) {
        const s = destino.width / origen.width;
        const dx = destino.left - origen.left;
        const dy = destino.top - origen.top;
        simbolo.current.animate([{ transform: "translate(0,0) scale(1)" }, { transform: `translate(${dx}px, ${dy}px) scale(${s})` }], { duration: dur, easing: FACIL, fill: "forwards" });
      } else simbolo.current.animate([{ opacity: 1 }, { opacity: 0 }], { duration: dur, fill: "forwards" });
      setTimeout(fin, dur);
    };

    // Total: dibujo + relleno + nombre ≈ 1,45 s y la salida 0,65 s → ≈ 2,1 s (×0,72 en el celular ≈ 1,5 s)
    // Desde que la intro apareció (lo marca el script en línea), no desde la hidratación: con JS lento igual dura ≤ 2,2 s
    const inicio = (window as unknown as { __introInicio?: number }).__introInicio ?? performance.now();
    const temporizador = window.setTimeout(() => salir(false), Math.max(0, 1450 * k - (performance.now() - inicio)));
    const saltar = () => salir(true);
    saltarRef.current = saltar;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") saltar();
    };
    const opciones = { passive: true } as const;
    window.addEventListener("keydown", tecla);
    window.addEventListener("wheel", saltar, opciones);
    window.addEventListener("touchmove", saltar, opciones);
    const quitarEscuchas = () => {
      window.removeEventListener("keydown", tecla);
      window.removeEventListener("wheel", saltar);
      window.removeEventListener("touchmove", saltar);
    };
    return () => {
      clearTimeout(temporizador);
      quitarEscuchas();
    };
  }, []);

  return (
    <div
      ref={capa}
      className="intro-marca"
      data-testid="intro"
      onPointerDown={() => saltarRef.current()}
    >
      <div data-intro-fondo className="intro-fondo" />
      <div className="intro-contenido">
        <div ref={simbolo} className="intro-simbolo">
          <svg viewBox={VIEWBOX_ISOTIPO} aria-hidden="true">
            {/* Contorno que se dibuja trazo a trazo… */}
            <g className="intro-trazos" fill="none" strokeWidth="3" strokeLinejoin="round">
              <path pathLength={1} d={D_J} />
              <path pathLength={1} d={D_P} />
              <path pathLength={1} className="intro-trazo-rasgo" d={D_RASGO} />
            </g>
            {/* …y luego el relleno con los colores del tema */}
            <g className="intro-relleno">
              <path d={D_J} />
              <path fillRule="evenodd" d={D_P} />
              <path className="intro-relleno-rasgo" d={D_RASGO} />
            </g>
          </svg>
        </div>
        <div data-intro-texto className="intro-texto" aria-hidden="true">
          <p className="intro-nombre">{nombre}</p>
          <span className="intro-linea" />
        </div>
      </div>
      <button type="button" className="intro-saltar" onClick={() => saltarRef.current()}>
        {textoSaltar}
      </button>
    </div>
  );
}

/** Rectángulo del monograma dentro del logo del encabezado (isotipo en el celular; parte izquierda del logo completo). */
function destinoLogo(): DOMRect | null {
  const svg = [...document.querySelectorAll<SVGSVGElement | HTMLImageElement>("[data-logo-cabecera] svg, [data-logo-cabecera] img")].find((e) => e.getBoundingClientRect().width > 0);
  if (!svg) return null;
  const r = svg.getBoundingClientRect();
  const vb = svg.getAttribute("viewBox");
  if (vb === VIEWBOX_ISOTIPO || !vb) return r;
  // Logo completo (viewBox 40 48 815 232): el monograma ocupa x 50–277, y 59–272 (escala .76 + traslado)
  const [x, y, w, h] = vb.split(" ").map(Number);
  const izq = r.left + ((50 - x) / w) * r.width;
  const arriba = r.top + ((59 - y) / h) * r.height;
  const ancho = (227 / w) * r.width;
  return new DOMRect(izq, arriba, ancho, (213 / h) * r.height);
}
