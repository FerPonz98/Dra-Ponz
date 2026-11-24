import { FileText, Receipt } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { requerirModulo } from "@/core/contexto";
import { Aviso } from "@/components/ui/aviso";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, EncabezadoPagina, EstadoVacio } from "@/components/ui/varios";
import { withOrg } from "@/lib/db";
import { formatoMoneda } from "@/lib/dinero";
import { formatoFecha } from "@/lib/fechas";
import { BadgePago } from "@/modules/cobros/componentes/estado";
import { listarPagos } from "@/modules/cobros/servicios/pagos";
import { comprobantesPorAprobar } from "@/modules/cobros/servicios/panel";
import { RevisionPago } from "./revision-pago";

export const metadata: Metadata = { title: "Comprobantes" };

export default async function PagosPage(props: { searchParams: Promise<{ hecho?: string }> }) {
  const { hecho } = await props.searchParams;
  const ctx = await requerirModulo("cobros", "cobros:aprobar");
  const { pendientes, mimes, recientes } = await withOrg(ctx.organizacion.id, async (tx) => ({
    pendientes: await listarPagos(tx, "pendiente"),
    mimes: new Map((await comprobantesPorAprobar(tx, 200)).map((c) => [c.id, c.mime])),
    recientes: [...(await listarPagos(tx, "aprobado")).slice(0, 10), ...(await listarPagos(tx, "rechazado")).slice(0, 5)].sort((a, b) => +(b.pago.revisadoEn ?? 0) - +(a.pago.revisadoEn ?? 0)),
  }));
  return (
    <div className="space-y-6">
      <EncabezadoPagina ayuda="aprobar-comprobantes" titulo="Comprobantes" descripcion="Revisa cada comprobante y apruébalo para marcar la cuota como pagada." />
      {hecho === "aprobado" && <Aviso tipo="exito">Pago aprobado.</Aviso>}
      {hecho === "rechazado" && <Aviso tipo="info">Pago rechazado. El cliente verá el motivo en su portal.</Aviso>}

      <section aria-labelledby="t-pendientes">
        <h2 id="t-pendientes" className="mb-3 text-sm font-semibold text-muted-foreground">
          Por aprobar ({pendientes.length})
        </h2>
        {pendientes.length === 0 ? (
          <Card>
            <EstadoVacio icono={Receipt} titulo="No hay comprobantes pendientes" descripcion="Cuando un cliente suba su comprobante desde el portal, lo verás aquí para aprobarlo." />
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {pendientes.map((r) => {
              const mime = mimes.get(r.pago.id);
              const url = r.pago.comprobanteArchivoId ? `/api/archivos/${r.pago.comprobanteArchivoId}` : null;
              return (
                <Card key={r.pago.id} data-testid="comprobante-pendiente" className="flex flex-col overflow-hidden">
                  <a href={url ?? undefined} target="_blank" rel="noopener" className="flex h-40 items-center justify-center border-b border-border bg-surface-2" aria-label={url && mime?.startsWith("image/") ? `Abrir comprobante de ${r.cliente.nombre}` : `Comprobante PDF de ${r.cliente.nombre}`}>
                    {url && mime?.startsWith("image/") ? (
                      // eslint-disable-next-line @next/next/no-img-element -- imagen privada servida por ruta autenticada
                      <img src={url} alt="" className="size-full object-contain" loading="lazy" />
                    ) : (
                      <span className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                        <FileText className="size-8" aria-hidden /> Comprobante PDF
                      </span>
                    )}
                  </a>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <Avatar nombre={r.cliente.nombre} className="size-8" />
                      <div className="min-w-0">
                        <CardTitle className="truncate">
                          {r.cliente.nombre} · cuota {r.cuota.numero}
                        </CardTitle>
                        <CardDescription className="truncate">
                          <Link className="hover:underline" href={`/panel/cobros/planes/${r.plan.id}`}>
                            {r.plan.titulo}
                          </Link>{" "}
                          · {formatoFecha(r.pago.creadoEn)}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="mt-auto space-y-3">
                    <div className="rounded-lg bg-surface-2 p-3">
                      <p className="text-xl font-semibold tabular-nums">{formatoMoneda(r.pago.montoBobCentavos, "BOB")}</p>
                      {r.pago.moneda === "BRL" && (
                        <p className="text-xs text-muted-foreground">
                          = {formatoMoneda(r.pago.montoCentavos, "BRL")} × TC {Number(r.pago.tipoCambio).toFixed(5)} ({formatoFecha(r.pago.tipoCambioFecha)})
                        </p>
                      )}
                    </div>
                    {url && (
                      <a className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline" href={url} target="_blank" rel="noopener">
                        Ver comprobante
                      </a>
                    )}
                    <RevisionPago pagoId={r.pago.id} />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {recientes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Revisados recientemente</CardTitle>
          </CardHeader>
          <ul className="divide-y divide-border border-t border-border">
            {recientes.map((r) => (
              <li key={r.pago.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {r.cliente.nombre} · cuota {r.cuota.numero}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatoMoneda(r.pago.montoBobCentavos, "BOB")} · {formatoFecha(r.pago.revisadoEn)}
                  </span>
                </span>
                <BadgePago estado={r.pago.estado} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
