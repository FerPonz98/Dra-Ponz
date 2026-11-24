// Marca de cada organización: logo completo e isotipo.
// - Subidos desde Configuración → Apariencia (SVG sanitizado o PNG): se sirven en /marca/{org}/{logo|isotipo}.
// - Si no subió nada y tiene una marca incorporada (la de la Dra.), se dibuja inline con los colores del tema.
// - Si no, la inicial del nombre (como antes).

/** Marcas incorporadas por organización (slug). Son los valores por defecto: se pueden reemplazar subiendo otras. */
export const MARCAS_INCORPORADAS: Record<string, "jp"> = { "dra-ponz": "jp" };

export type OrgMarca = { id: string; slug: string; nombre: string; logoArchivoId: string | null; isotipoArchivoId: string | null };

export type Marca =
  | { tipo: "incorporada"; marca: "jp"; nombre: string }
  | { tipo: "archivo"; nombre: string; logo: string | null; isotipo: string | null }
  | { tipo: "inicial"; nombre: string; letra: string };

export const urlMarca = (organizacionId: string, cual: "logo" | "isotipo") => `/marca/${organizacionId}/${cual}`;

export function inicial(nombre: string) {
  return nombre.replace(/^(Dra?\.|Lic\.)\s*/i, "").trim()[0]?.toUpperCase() ?? "·";
}

export function marcaDe(o: OrgMarca): Marca {
  if (o.logoArchivoId || o.isotipoArchivoId) {
    return { tipo: "archivo", nombre: o.nombre, logo: o.logoArchivoId ? urlMarca(o.id, "logo") : null, isotipo: o.isotipoArchivoId ? urlMarca(o.id, "isotipo") : null };
  }
  const inc = MARCAS_INCORPORADAS[o.slug];
  if (inc) return { tipo: "incorporada", marca: inc, nombre: o.nombre };
  return { tipo: "inicial", nombre: o.nombre, letra: inicial(o.nombre) };
}
