"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Activa la aparición al hacer scroll (.revelar) solo si hay JS (sin JS todo se ve). Con movimiento
 * reducido el CSS deja solo el fundido. También da scroll suave a los enlaces internos (#sección).
 */
export function Revelador() {
  useEffect(() => {
    const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const alClic = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]');
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return;
      const id = decodeURIComponent(a.hash.slice(1));
      const destino = id && document.getElementById(id);
      if (!destino) return;
      e.preventDefault();
      destino.scrollIntoView({ behavior: reducido ? "auto" : "smooth", block: "start" });
      history.pushState(null, "", `#${id}`);
      if (!destino.hasAttribute("tabindex")) destino.setAttribute("tabindex", "-1");
      destino.focus({ preventScroll: true });
    };
    document.addEventListener("click", alClic);
    return () => document.removeEventListener("click", alClic);
  }, []);

  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const raiz = document.documentElement;
    const elementos = Array.from(document.querySelectorAll<HTMLElement>(".revelar"));
    const fueraDeVista = elementos.filter((el) => el.getBoundingClientRect().top > window.innerHeight * 0.9);
    if (!fueraDeVista.length) return;
    raiz.classList.add("js-animar");
    elementos.filter((el) => !fueraDeVista.includes(el)).forEach((el) => el.classList.add("visible"));
    const io = new IntersectionObserver(
      (entradas) =>
        entradas.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("visible");
            io.unobserve(e.target);
          }
        }),
      { rootMargin: "0px 0px -8% 0px" },
    );
    fueraDeVista.forEach((el) => io.observe(el));
    return () => {
      io.disconnect();
      raiz.classList.remove("js-animar");
    };
  }, []);
  return null;
}

/** Número que cuenta hacia arriba al entrar en pantalla (sin animación con movimiento reducido). */
export function Contador({ texto }: { texto: string }) {
  const m = texto.match(/^(\D*)(\d+)(\D*)$/);
  const ref = useRef<HTMLSpanElement>(null);
  const objetivo = m ? Number(m[2]) : 0;
  const [valor, setValor] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!/^\D*\d+\D*$/.test(texto) || !el || window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    if (el.getBoundingClientRect().top < window.innerHeight) return; // ya visible al cargar: no se anima
    setValor(0);
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const inicio = performance.now();
      const dur = 1100;
      const paso = (t: number) => {
        const p = Math.min(1, (t - inicio) / dur);
        setValor(Math.round(objetivo * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(paso);
      };
      requestAnimationFrame(paso);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [texto, objetivo]);

  if (!m) return <span>{texto}</span>;
  return (
    <span ref={ref} className="tabular-nums">
      <span className="sr-only">{texto}</span>
      <span aria-hidden>
        {m[1]}
        {valor ?? objetivo}
        {m[3]}
      </span>
    </span>
  );
}
