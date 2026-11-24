import type { Metadata } from "next";
import { requerirOrganizacion } from "@/core/contexto";
import { EncabezadoPagina } from "@/components/ui/varios";
import { seccionesDeManual } from "@/lib/manual";
import { ManualNavegable } from "./manual-navegable";

export const metadata: Metadata = { title: "Ayuda" };

export default async function AyudaPage() {
  await requerirOrganizacion();
  const secciones = await seccionesDeManual("dra");
  return (
    <div>
      <EncabezadoPagina
        titulo="Ayuda"
        descripcion={
          <>
            El manual de uso del panel, paso a paso. Busca una palabra o elige un tema. ¿Prefieres leerlo en papel? Descárgalo en{" "}
            <a className="font-medium text-primary underline underline-offset-2" href="/ayuda/pdf/manual-dra-ponz.pdf" target="_blank" rel="noopener">
              PDF
            </a>
            .
          </>
        }
      />
      <ManualNavegable secciones={secciones.map(({ id, titulo, html, texto, subtitulos }) => ({ id, titulo, html, texto, subtitulos: subtitulos.map((s) => ({ id: s.id, texto: s.texto })) }))} />
    </div>
  );
}
