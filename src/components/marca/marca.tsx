// Logo e isotipo de la marca, inline, tomando los colores del TEMA de la organización (Configuración → Apariencia).
// Variantes: "tema" (primario + acento del tema; sin tema, los colores originales), "actual" (currentColor),
// "blanco" y "negro" (un color, con el filo que separa el rasgo de las letras).
import type { SVGProps } from "react";
import { marcaDe, type OrgMarca } from "@/core/marca/marca";
import { cn } from "@/lib/utils";
import { COLOR_MARCA, D_GEO, D_GEO_BANDA, D_J, D_LEMA, D_NOMBRE, D_P, D_RASGO, VIEWBOX_GEOMETRICO, VIEWBOX_ISOTIPO, VIEWBOX_LOGO } from "./trazos";

export type VarianteMarca = "tema" | "actual" | "blanco" | "negro";
type Props = Omit<SVGProps<SVGSVGElement>, "children"> & { variante?: VarianteMarca; titulo?: string | null };

function colores(v: VarianteMarca) {
  if (v === "blanco") return { p: "#fff", a: "#fff", uno: true };
  if (v === "negro") return { p: "#000", a: "#000", uno: true };
  if (v === "actual") return { p: "currentColor", a: "currentColor", uno: true };
  // Landing/portal: variables del tema. Panel (sin tema en modo oscuro): el primario de la plataforma.
  return { p: `var(--color-primario, var(--primary, ${COLOR_MARCA.primario}))`, a: `var(--color-acento, ${COLOR_MARCA.acento})`, uno: false };
}

function Accesible({ titulo }: { titulo?: string | null }) {
  return titulo ? <title>{titulo}</title> : null;
}

/** J + P + rasgo. En un solo color, el rasgo recorta un filo en las letras para que se siga leyendo. */
function Monograma({ v, id }: { v: VarianteMarca; id: string }) {
  const { p, a, uno } = colores(v);
  return uno ? (
    <>
      <defs>
        <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width="400" height="400">
          <rect width="400" height="400" fill="#fff" />
          <path fill="#000" stroke="#000" strokeWidth="14" strokeLinejoin="round" d={D_RASGO} />
        </mask>
      </defs>
      <g mask={`url(#${id})`}>
        <path fill={p} d={D_J} />
        <path fill={p} fillRule="evenodd" d={D_P} />
      </g>
      <path fill={a} d={D_RASGO} />
    </>
  ) : (
    <>
      <path fill={p} d={D_J} />
      <path fill={p} fillRule="evenodd" d={D_P} />
      <path fill={a} d={D_RASGO} />
    </>
  );
}

const aria = (titulo: string | null | undefined) => (titulo ? { role: "img", "aria-label": titulo } : { "aria-hidden": true as const });

export function Isotipo({ variante = "tema", titulo = "Dra. Julieta Ponz", ...p }: Props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={VIEWBOX_ISOTIPO} {...aria(titulo)} {...p}>
      <Accesible titulo={titulo} />
      <Monograma v={variante} id={`jp-filo-${variante}`} />
    </svg>
  );
}

export function IsotipoGeometrico({ variante = "tema", titulo = "Dra. Julieta Ponz", ...p }: Props) {
  const c = colores(variante);
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={VIEWBOX_GEOMETRICO} {...aria(titulo)} {...p}>
      <Accesible titulo={titulo} />
      <defs>
        <mask id="jp-geo-corte" maskUnits="userSpaceOnUse" x="0" y="0" width="400" height="400">
          <rect width="400" height="400" fill="#fff" />
          <path fill="#000" d={D_GEO_BANDA} />
        </mask>
      </defs>
      <g mask="url(#jp-geo-corte)">
        <path fill={c.p} d={D_GEO[0]} />
        <path fill={c.a} d={D_GEO[1]} />
        <path fill={c.p} d={D_GEO[2]} />
      </g>
    </svg>
  );
}

/** Logo completo. conLema={false}: sin "Investigación · Docencia · Asesoría" (para alturas chicas, donde no se leería). */
export function Logo({ variante = "tema", titulo = "Dra. Julieta Ponz — Investigación, Docencia, Asesoría", conLema = true, ...p }: Props & { conLema?: boolean }) {
  const c = colores(variante);
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={VIEWBOX_LOGO} {...aria(titulo)} {...p}>
      <Accesible titulo={titulo} />
      <g transform="translate(10 4) scale(.76)">
        <Monograma v={variante} id={`jp-filo-logo-${variante}`} />
      </g>
      <path fill={c.p} d={D_NOMBRE} />
      {conLema && <path fill={c.p} d={D_LEMA} />}
    </svg>
  );
}

/**
 * Marca de una organización: la subida (logo o isotipo), la incorporada (JP, con los colores del tema) o la inicial.
 * `cual`: "logo" (completo, para encabezados anchos) o "isotipo" (cuadrado, para espacios chicos).
 */
export function MarcaOrganizacion({ org, cual, variante = "tema", className, claseInicial, conLema }: { org: OrgMarca; cual: "logo" | "isotipo"; variante?: VarianteMarca; className?: string; claseInicial?: string; conLema?: boolean }) {
  const m = marcaDe(org);
  if (m.tipo === "incorporada") return cual === "logo" ? <Logo variante={variante} titulo={m.nombre} className={className} conLema={conLema} /> : <Isotipo variante={variante} titulo={m.nombre} className={className} />;
  if (m.tipo === "archivo") {
    const src = cual === "logo" ? (m.logo ?? m.isotipo) : (m.isotipo ?? m.logo);
    // eslint-disable-next-line @next/next/no-img-element -- logo de la organización (SVG sanitizado o PNG), servido por /marca
    return <img src={src!} alt={m.nombre} className={cn("object-contain", className)} />;
  }
  return (
    <span className={cn("flex items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground", claseInicial ?? className)} aria-hidden>
      {m.letra}
    </span>
  );
}
