import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { ImageResponse } from "next/og";
import { D_J, D_P, D_RASGO, VIEWBOX_ISOTIPO } from "@/components/marca/trazos";
import { leerArchivo } from "@/core/archivos";
import { archivos } from "@/core/db/schema";
import { MARCAS_INCORPORADAS, inicial } from "@/core/marca/marca";
import { temaDeOrganizacion } from "@/core/tema/cache";
import { derivarColores, TEMA_POR_DEFECTO } from "@/core/tema/tema";
import { withOrg } from "@/lib/db";
import { organizacionDeLandingCacheada } from "@/modules/tesis/servicios/landing-cache";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Dra. Julieta Ponz — Asesoría de Tesis · Pregrado y Posgrado";

/** Imagen para compartir (WhatsApp, Facebook…): marca + "Asesoría de Tesis" con los colores del tema de la organización. */
export default async function Imagen({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const pt = locale === "pt";
  const org = await organizacionDeLandingCacheada((await headers()).get("host"));
  const c = derivarColores((org && (await temaDeOrganizacion(org.id))) || TEMA_POR_DEFECTO);
  const nombre = org?.nombre.replace(/^Dra\. Elizabeth Julieta Ponz Sejas$/, "Dra. Julieta Ponz") ?? "Dra. Julieta Ponz";

  // Marca: isotipo/logo subido (como data URL), el monograma incorporado (trazos) o la inicial
  let subida: string | null = null;
  const idArchivo = org?.isotipoArchivoId ?? org?.logoArchivoId;
  if (org && idArchivo) {
    const [a] = await withOrg(org.id, (tx) => tx.select().from(archivos).where(eq(archivos.id, idArchivo)));
    const datos = a ? await leerArchivo(a.rutaRelativa).catch(() => null) : null;
    if (a && datos) subida = `data:${a.tipoMime};base64,${datos.toString("base64")}`;
  }
  const incorporada = !subida && (!org || !!MARCAS_INCORPORADAS[org.slug]);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: c.fondo, color: c.texto, fontFamily: "serif" }}>
        <div style={{ width: 22, height: "100%", background: c.acento, display: "flex" }} />
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 64, padding: "0 90px" }}>
          <div style={{ width: 300, height: 300, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 40, background: c.superficie, border: `3px solid ${c.primarioBorde}` }}>
            {subida ? (
              // eslint-disable-next-line @next/next/no-img-element -- next/og (Satori), no es HTML
              <img src={subida} width={230} height={230} style={{ objectFit: "contain" }} alt="" />
            ) : incorporada ? (
              <svg viewBox={VIEWBOX_ISOTIPO} width={240} height={218}>
                <path d={D_J} fill={c.primario} />
                <path d={D_P} fill={c.primario} fillRule="evenodd" />
                <path d={D_RASGO} fill={c.acento} />
              </svg>
            ) : (
              <div style={{ fontSize: 160, fontWeight: 700, color: c.primarioTexto }}>{inicial(nombre)}</div>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div style={{ fontSize: 70, fontWeight: 600, color: c.titulo, lineHeight: 1.05, letterSpacing: -1 }}>{nombre}</div>
            <div style={{ width: 120, height: 5, background: c.acento, margin: "30px 0 28px", display: "flex" }} />
            <div style={{ fontSize: 40, color: c.primarioTexto, fontFamily: "sans-serif" }}>{pt ? "Orientação de Tese · Graduação e Pós-graduação" : "Asesoría de Tesis · Pregrado y Posgrado"}</div>
            <div style={{ fontSize: 26, marginTop: 26, color: c.textoSuave, fontFamily: "sans-serif" }}>{pt ? "29 anos de docência · 58 teses orientadas" : "29 años de docencia · 58 tesis acompañadas"}</div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
