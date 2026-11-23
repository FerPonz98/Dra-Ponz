import type { Metadata } from "next";
import { withOrg } from "@/lib/db";
import { hoyEnZona } from "@/lib/fechas";
import { PortalCobros } from "@/modules/cobros/componentes/portal-cobros";
import { datosPortal } from "@/modules/cobros/servicios/portal";
import { sesionPortal } from "../sesion";
import { AccesoPortal } from "./acceso-portal";
import { accionSubirComprobante } from "./acciones";

export const metadata: Metadata = { title: "Mi plan de pagos", robots: { index: false, follow: false }, referrer: "no-referrer" };

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
        <Contenido token={token} organizacionId={resuelto.organizacion.id} zona={resuelto.organizacion.zonaHoraria} planId={resuelto.enlace.planId} qr={!!resuelto.organizacion.qrArchivoId} banco={resuelto.organizacion.datosBancarios} />
      )}
    </main>
  );
}

async function Contenido(p: { token: string; organizacionId: string; zona: string; planId: string; qr: boolean; banco: string | null }) {
  const d = await withOrg(p.organizacionId, (tx) => datosPortal(tx, p.planId, hoyEnZona(p.zona)));
  if (!d) return <p>Plan no encontrado.</p>;
  return <PortalCobros d={d} qrUrl={p.qr ? `/p/${p.token}/qr` : null} datosBancarios={p.banco} accionSubir={accionSubirComprobante.bind(null, p.token)} />;
}
