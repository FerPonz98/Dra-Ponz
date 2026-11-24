import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { requerirModulo } from "@/core/contexto";
import { organizaciones } from "@/core/db/schema";
import { EncabezadoPagina } from "@/components/ui/varios";
import { withOrg } from "@/lib/db";
import { SECCIONES_LANDING } from "@/modules/tesis/dominio/landing";
import { contenidoLanding } from "@/modules/tesis/servicios/landing";
import { EditorLanding } from "./editor-landing";
import { FotoLanding } from "./foto-landing";

export const metadata: Metadata = { title: "Landing pública" };

export default async function LandingEditorPage(props: { searchParams: Promise<{ idioma?: string }> }) {
  const ctx = await requerirModulo("tesis", "tesis:editar");
  const { idioma: q } = await props.searchParams;
  const idioma = q === "pt" ? "pt" : "es";
  const orgId = ctx.organizacion.id;
  const { c, foto } = await withOrg(orgId, async (tx) => ({
    c: await contenidoLanding(tx, idioma),
    foto: (await tx.select({ id: organizaciones.fotoLandingArchivoId }).from(organizaciones).where(eq(organizaciones.id, orgId)))[0]?.id ?? null,
  }));
  return (
    <div className="mx-auto max-w-4xl">
      <EncabezadoPagina ayuda="landing" titulo="Landing pública" descripcion="Tu foto y todos los textos de julietaponz.com, en español y portugués." />
      <div className="mb-4">
        <FotoLanding url={foto ? `/marca/${orgId}/foto?v=${foto.slice(0, 8)}` : null} />
      </div>
      <EditorLanding key={idioma} idioma={idioma} secciones={SECCIONES_LANDING} valores={c} />
    </div>
  );
}
