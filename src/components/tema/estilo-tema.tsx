import { cssTema, type Tema } from "@/core/tema/tema";

/**
 * Variables CSS del tema generadas en el servidor. React las sube al <head> (precedence), así que
 * llegan con el HTML inicial: no hay parpadeo de colores. El CSS solo contiene HEX validados.
 */
export function EstiloTema({ tema, alcance, id }: { tema: Tema; alcance: "landing" | "portal" | "panel"; id: string }) {
  const css = cssTema(tema, alcance);
  return (
    <style href={`tema-${alcance}-${id}-${hash(css)}`} precedence="tema">
      {css}
    </style>
  );
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
