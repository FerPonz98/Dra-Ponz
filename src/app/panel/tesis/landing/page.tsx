import type { Metadata } from "next";
import { requerirModulo } from "@/core/contexto";
import { EncabezadoPagina } from "@/components/ui/varios";
import { withOrg } from "@/lib/db";
import { SECCIONES_LANDING } from "@/modules/tesis/dominio/landing";
import { contenidoLanding } from "@/modules/tesis/servicios/landing";
import { EditorLanding } from "./editor-landing";

export const metadata: Metadata = { title: "Landing pública" };

export default async function LandingEditorPage(props: { searchParams: Promise<{ idioma?: string }> }) {
  const ctx = await requerirModulo("tesis", "tesis:editar");
  const { idioma: q } = await props.searchParams;
  const idioma = q === "pt" ? "pt" : "es";
  const c = await withOrg(ctx.organizacion.id, (tx) => contenidoLanding(tx, idioma));
  return (
    <div className="mx-auto max-w-4xl">
      <EncabezadoPagina
        titulo="Landing pública"
        descripcion={
          <>
            Todos los textos de julietaponz.com, en español y portugués. La foto se reemplaza subiendo <code className="rounded bg-surface-2 px-1 font-mono text-xs">public/landing/foto-dra.webp</code> al servidor.
          </>
        }
      />
      <EditorLanding key={idioma} idioma={idioma} secciones={SECCIONES_LANDING} valores={c} />
    </div>
  );
}
