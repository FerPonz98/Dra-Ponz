import { CircleHelp, LinkIcon, Lock } from "lucide-react";
import type { Metadata } from "next";
import { MarcaOrganizacion } from "@/components/marca/marca";
import { clasesFuentes } from "@/components/tema/fuentes";
import type { OrgMarca } from "@/core/marca/marca";
import { EstiloTema } from "@/components/tema/estilo-tema";
import { temaDeOrganizacion } from "@/core/tema/cache";
import { withOrg } from "@/lib/db";
import { hoyEnZona } from "@/lib/fechas";
import { PortalCobros } from "@/modules/cobros/componentes/portal-cobros";
import { datosPortal } from "@/modules/cobros/servicios/portal";
import { PortalTesis } from "@/modules/tesis/componentes/portal-tesis";
import { obtenerProyecto, REFERENCIA_PROPUESTA, sincronizarProyecto } from "@/modules/tesis/servicios/propuestas";
import { sesionPortal } from "../sesion";
import { AccesoPortal } from "./acceso-portal";
import { accionAceptarCronograma, accionAceptarPropuesta } from "./acciones-tesis";
import { extrasPortalTesis } from "./extras-tesis";

export const metadata: Metadata = { title: "Mi portal", robots: { index: false, follow: false }, referrer: "no-referrer" };

function Encabezado({ org }: { org: OrgMarca }) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-xl items-center gap-3 px-4">
        {/* Marca de la organización: isotipo subido, el incorporado (con los colores del tema) o la inicial */}
        <MarcaOrganizacion org={org} cual="isotipo" className="size-10" claseInicial="size-9 rounded-xl text-sm shadow-sm" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">{org.nombre}</p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Lock className="size-3" aria-hidden /> Portal privado
          </p>
        </div>
        <BotonGuia />
      </div>
    </header>
  );
}

/** "¿Necesitas ayuda?": abre la guía del estudiante (ES/PT) en otra pestaña, sin perder el portal. */
function BotonGuia({ ancla }: { ancla?: string }) {
  return (
    <a
      href={`/ayuda/estudiante${ancla ? `#${ancla}` : ""}`}
      target="_blank"
      rel="noopener"
      data-testid="boton-guia"
      className={`${ancla ? "" : "ml-auto "}inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground shadow-xs hover:bg-muted`}
    >
      <CircleHelp className="size-4 text-primary" aria-hidden />
      ¿Necesitas ayuda?
    </a>
  );
}

export default async function PortalPage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  const { resuelto, autorizado } = await sesionPortal(token);

  if (!resuelto) {
    return (
      <main className="flex flex-1 items-center justify-center bg-background px-4 py-16">
        <div className="max-w-sm text-center">
          <span className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <LinkIcon className="size-6" aria-hidden />
          </span>
          <h1 className="text-xl font-semibold tracking-tight">Enlace no disponible</h1>
          <p className="mt-2 text-muted-foreground">Este enlace venció o fue reemplazado. Pide uno nuevo a quien te lo envió y con gusto te lo reenvía.</p>
          <div className="mt-6 flex justify-center">
            <BotonGuia ancla="si-algo-falla" />
          </div>
        </div>
      </main>
    );
  }
  const org = resuelto.organizacion;
  // Tema de la marca: colores, fuentes y bordes elegidos en Configuración → Apariencia (si los eligió).
  const tema = await temaDeOrganizacion(org.id);
  return (
    <div className={`flex min-h-screen flex-1 flex-col bg-background ${tema ? `portal-tema tema-fuentes font-texto ${clasesFuentes(tema)}` : ""}`}>
      {tema && <EstiloTema tema={tema} alcance="portal" id={org.id} />}
      <Encabezado org={org} />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-16 pt-6">
        {!autorizado ? (
          <AccesoPortal token={token} metodo={resuelto.enlace.metodo} organizacion={org.nombre} />
        ) : (
          <Contenido token={token} organizacionId={org.id} zona={org.zonaHoraria} planId={resuelto.enlace.planId} qr={!!org.qrArchivoId} banco={org.datosBancarios} referenciaTipo={resuelto.enlace.referenciaTipo} referenciaId={resuelto.enlace.referenciaId} />
        )}
      </main>
      <footer className="pb-6 text-center text-xs text-subtle-foreground">Tus datos están protegidos. Solo tú y {org.nombre} los ven.</footer>
    </div>
  );
}

async function Contenido(p: { token: string; organizacionId: string; zona: string; planId: string; qr: boolean; banco: string | null; referenciaTipo: string | null; referenciaId: string | null }) {
  const hoy = hoyEnZona(p.zona);
  const qrUrl = p.qr ? `/p/${p.token}/qr` : null;
  const urlComprobante = `/p/${p.token}/comprobante`;
  // Tesis extiende el portal de Cobros cuando el enlace pertenece a una propuesta.
  if (p.referenciaTipo === REFERENCIA_PROPUESTA && p.referenciaId) {
    const datos = await withOrg(p.organizacionId, async (tx) => {
      await sincronizarProyecto(tx, p.referenciaId!, hoy);
      return { proyecto: await obtenerProyecto(tx, p.referenciaId!), d: await datosPortal(tx, p.planId, hoy) };
    });
    if (!datos.proyecto || !datos.d) return <p>Propuesta no encontrada.</p>;
    return (
      <PortalTesis
        p={datos.proyecto}
        d={datos.d}
        token={p.token}
        hoy={hoy}
        qrUrl={qrUrl}
        datosBancarios={p.banco}
        urlComprobante={urlComprobante}
        acciones={{ aceptar: accionAceptarPropuesta.bind(null, p.token), aceptarCronograma: accionAceptarCronograma.bind(null, p.token) }}
        extras={await extrasPortalTesis(p.token, p.organizacionId, datos.proyecto)}
      />
    );
  }
  const d = await withOrg(p.organizacionId, (tx) => datosPortal(tx, p.planId, hoy));
  if (!d) return <p>Plan no encontrado.</p>;
  return <PortalCobros d={d} qrUrl={qrUrl} datosBancarios={p.banco} urlComprobante={urlComprobante} />;
}
