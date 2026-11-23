import type { Metadata } from "next";
import { withOrg } from "@/lib/db";
import { hoyEnZona } from "@/lib/fechas";
import { PortalCobros } from "@/modules/cobros/componentes/portal-cobros";
import { datosPortal } from "@/modules/cobros/servicios/portal";
import { sesionPortal } from "../sesion";
import { AccesoPortal } from "./acceso-portal";
import { accionSubirComprobante } from "./acciones";
import { accionAceptarCronograma, accionAceptarPropuesta } from "./acciones-tesis";
import { extrasPortalTesis } from "./extras-tesis";
import { PortalTesis } from "@/modules/tesis/componentes/portal-tesis";
import { obtenerProyecto, REFERENCIA_PROPUESTA, sincronizarProyecto } from "@/modules/tesis/servicios/propuestas";

export const metadata: Metadata = { title: "Mi portal", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function PortalPage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  const { resuelto, autorizado } = await sesionPortal(token);

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-6" style={resuelto ? { ["--primary" as string]: resuelto.organizacion.colorPrimario } : undefined}>
      {!resuelto ? (
        <div className="py-16 text-center">
          <h1 className="text-xl font-semibold">Enlace no disponible</h1>
          <p className="mt-2 text-muted-foreground">El enlace venció o fue anulado. Pide uno nuevo a quien te lo envió.</p>
        </div>
      ) : !autorizado ? (
        <AccesoPortal token={token} metodo={resuelto.enlace.metodo} organizacion={resuelto.organizacion.nombre} />
      ) : (
        <Contenido token={token} organizacionId={resuelto.organizacion.id} zona={resuelto.organizacion.zonaHoraria} planId={resuelto.enlace.planId}
          qr={!!resuelto.organizacion.qrArchivoId}
          banco={resuelto.organizacion.datosBancarios}
          referenciaTipo={resuelto.enlace.referenciaTipo}
          referenciaId={resuelto.enlace.referenciaId}
        />
      )}
    </main>
  );
}

async function Contenido(p: { token: string; organizacionId: string; zona: string; planId: string; qr: boolean; banco: string | null; referenciaTipo: string | null; referenciaId: string | null }) {
  const hoy = hoyEnZona(p.zona);
  const qrUrl = p.qr ? `/p/${p.token}/qr` : null;
  const accionSubir = accionSubirComprobante.bind(null, p.token);
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
        acciones={{ aceptar: accionAceptarPropuesta.bind(null, p.token), aceptarCronograma: accionAceptarCronograma.bind(null, p.token), subirComprobante: accionSubir }}
        extras={await extrasPortalTesis(p.token, p.organizacionId, datos.proyecto)}
      />
    );
  }
  const d = await withOrg(p.organizacionId, (tx) => datosPortal(tx, p.planId, hoy));
  if (!d) return <p>Plan no encontrado.</p>;
  return <PortalCobros d={d} qrUrl={qrUrl} datosBancarios={p.banco} accionSubir={accionSubir} />;
}
