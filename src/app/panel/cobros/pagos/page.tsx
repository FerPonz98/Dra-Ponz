import type { Metadata } from "next";
import Link from "next/link";
import { requerirModulo } from "@/core/contexto";
import { Aviso } from "@/components/ui/aviso";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { withOrg } from "@/lib/db";
import { formatoMoneda } from "@/lib/dinero";
import { formatoFecha } from "@/lib/fechas";
import { BadgePago } from "@/modules/cobros/componentes/estado";
import { listarPagos } from "@/modules/cobros/servicios/pagos";
import { RevisionPago } from "./revision-pago";

export const metadata: Metadata = { title: "Comprobantes" };

export default async function PagosPage(props: { searchParams: Promise<{ hecho?: string }> }) {
  const { hecho } = await props.searchParams;
  const ctx = await requerirModulo("cobros", "cobros:aprobar");
  const { pendientes, recientes } = await withOrg(ctx.organizacion.id, async (tx) => ({
    pendientes: await listarPagos(tx, "pendiente"),
    recientes: [...(await listarPagos(tx, "aprobado")).slice(0, 10), ...(await listarPagos(tx, "rechazado")).slice(0, 5)],
  }));
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Comprobantes por aprobar</h1>
      {hecho === "aprobado" && <Aviso tipo="exito">Pago aprobado.</Aviso>}
      {hecho === "rechazado" && <Aviso tipo="info">Pago rechazado. El cliente verá el motivo en su portal.</Aviso>}
      {pendientes.length === 0 && <p className="text-sm text-muted-foreground">No hay comprobantes pendientes.</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {pendientes.map((r) => (
          <Card key={r.pago.id} data-testid="comprobante-pendiente">
            <CardHeader>
              <CardTitle className="text-base">
                {r.cliente.nombre} · cuota {r.cuota.numero}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                <Link className="hover:underline" href={`/panel/cobros/planes/${r.plan.id}`}>
                  {r.plan.titulo}
                </Link>{" "}
                · enviado {formatoFecha(r.pago.creadoEn)}
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-lg font-semibold">
                {formatoMoneda(r.pago.montoBobCentavos, "BOB")}
                {r.pago.moneda === "BRL" && (
                  <span className="block text-xs font-normal text-muted-foreground">
                    = {formatoMoneda(r.pago.montoCentavos, "BRL")} × TC {Number(r.pago.tipoCambio).toFixed(5)} ({formatoFecha(r.pago.tipoCambioFecha)})
                  </span>
                )}
              </p>
              {r.pago.comprobanteArchivoId && (
                <a className="text-sm text-primary underline" href={`/api/archivos/${r.pago.comprobanteArchivoId}`} target="_blank" rel="noopener">
                  Ver comprobante
                </a>
              )}
              <RevisionPago pagoId={r.pago.id} />
            </CardContent>
          </Card>
        ))}
      </div>
      {recientes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Revisados recientemente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {recientes.map((r) => (
              <div key={r.pago.id} className="flex items-center justify-between border-b py-1 last:border-0">
                <span>
                  {r.cliente.nombre} · cuota {r.cuota.numero} · {formatoMoneda(r.pago.montoBobCentavos, "BOB")}
                </span>
                <BadgePago estado={r.pago.estado} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
