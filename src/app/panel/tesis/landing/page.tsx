import type { Metadata } from "next";
import { requerirModulo } from "@/core/contexto";
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
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold">Landing pública</h1>
      <p className="text-sm text-muted-foreground">
        Todos los textos de la página pública se editan aquí, por idioma. La foto se reemplaza subiendo el archivo <code>public/landing/foto-dra.webp</code> al servidor (ver README).
      </p>
      <EditorLanding key={idioma} idioma={idioma} secciones={SECCIONES_LANDING} valores={c} />
    </div>
  );
}
