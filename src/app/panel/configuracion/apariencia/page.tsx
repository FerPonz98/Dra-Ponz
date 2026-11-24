import type { Metadata } from "next";
import { clasesFuentes } from "@/components/tema/fuentes";
import { EncabezadoPagina } from "@/components/ui/varios";
import { requerirPermiso } from "@/core/contexto";
import { obtenerTema } from "@/core/tema/servicio";
import { withOrg } from "@/lib/db";
import { EditorApariencia } from "./editor-apariencia";
import { SeccionMarca } from "./marca-organizacion";

export const metadata: Metadata = { title: "Apariencia" };

export default async function AparienciaPage() {
  const ctx = await requerirPermiso("organizacion:configurar");
  const tema = await withOrg(ctx.organizacion.id, obtenerTema);
  const o = ctx.organizacion;
  return (
    <div className={`mx-auto max-w-7xl ${clasesFuentes()}`}>
      <EncabezadoPagina ayuda="apariencia" titulo="Apariencia" descripcion="Los colores, las fuentes y los bordes de tu landing y del portal de tus clientes. El panel conserva su diseño y toma tu color primario para los acentos." />
      <EditorApariencia guardado={tema} nombre={ctx.organizacion.nombre} />
      <div className="mt-6 lg:max-w-[calc(100%-28rem)]">
        <SeccionMarca org={{ id: o.id, slug: o.slug, nombre: o.nombre, logoArchivoId: o.logoArchivoId, isotipoArchivoId: o.isotipoArchivoId }} />
      </div>
    </div>
  );
}
