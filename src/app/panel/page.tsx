import { AlertTriangle, ArrowRight, CircleDollarSign, Clock, FileText, Inbox, PartyPopper, PauseCircle, TrendingUp } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { hoyDe, requerirOrganizacion } from "@/core/contexto";
import { Aviso } from "@/components/ui/aviso";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { EncabezadoPagina, EstadoVacio, MiniGrafico, TarjetaKpi } from "@/components/ui/varios";
import { withOrg } from "@/lib/db";
import { formatoMoneda } from "@/lib/dinero";
import { formatoFecha } from "@/lib/fechas";
import { FilaRecordatorio } from "@/modules/cobros/componentes/fila-recordatorio";
import { comprobantesPorAprobar, recordatoriosDeHoy, resumenPanel, seriesPanel } from "@/modules/cobros/servicios/panel";
import { alertasActivas, ultimasCotizaciones } from "@/modules/cobros/servicios/tipo-cambio";
import { RevisionPago } from "./cobros/pagos/revision-pago";

export const metadata: Metadata = { title: "Inicio" };

function saludo(zona: string) {
  const h = Number(new Intl.DateTimeFormat("en-US", { timeZone: zona, hour: "numeric", hour12: false }).format(new Date()));
  return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
}

export default async function PanelPage() {
  const ctx = await requerirOrganizacion();
  const hoy = hoyDe(ctx);
  const zona = ctx.organizacion.zonaHoraria;
  const cobros = ctx.modulos.includes("cobros") && ctx.puede("cobros:ver");
  const datos = cobros
    ? await withOrg(ctx.organizacion.id, async (tx) => ({
        resumen: await resumenPanel(tx, hoy, zona),
        series: await seriesPanel(tx, hoy, zona),
        recordar: await recordatoriosDeHoy(tx, hoy),
        comprobantes: ctx.puede("cobros:aprobar") ? await comprobantesPorAprobar(tx) : [],
        alertas: await alertasActivas(tx),
        tc: (await ultimasCotizaciones(tx, 1))[0] ?? null,
      }))
    : null;
  const nombre = ctx.usuario.nombre.replace(/^(Dra?\.|Lic\.)\s*/i, "").split(" ")[0];
  const fecha = new Intl.DateTimeFormat("es-BO", { timeZone: zona, weekday: "long", day: "numeric", month: "long" }).format(new Date());

  let variacion: { texto: string; positiva: boolean | null } | undefined;
  if (datos) {
    const [prev, act] = datos.series.cobrado.slice(-2);
    variacion = prev > 0 ? { texto: `${act >= prev ? "▲" : "▼"} ${Math.abs(Math.round(((act - prev) / prev) * 100))}% vs. mes anterior`, positiva: act >= prev } : act > 0 ? { texto: "Primer mes con cobros", positiva: true } : undefined;
  }
  const monto = (m: { BOB: number; BRL: number }) => (
    <>
      {formatoMoneda(m.BOB, "BOB")}
      {m.BRL > 0 && <span className="ml-1.5 text-sm font-medium text-muted-foreground">+ {formatoMoneda(m.BRL, "BRL")}</span>}
    </>
  );

  return (
    <div className="space-y-6">
      <EncabezadoPagina
        titulo={`${saludo(zona)}, ${nombre}`}
        descripcion={<span className="first-letter:uppercase">{fecha} · {ctx.organizacion.nombre}</span>}
        acciones={
          <>
            {ctx.modulos.includes("tesis") && ctx.puede("tesis:editar") && (
              <Button asChild variant="outline">
                <Link href="/panel/tesis/propuestas/nueva">Nueva propuesta</Link>
              </Button>
            )}
            {cobros && ctx.puede("cobros:editar") && (
              <Button asChild>
                <Link href="/panel/cobros/planes/nuevo">Nuevo plan de pagos</Link>
              </Button>
            )}
          </>
        }
      />

      {!datos && (
        <Card>
          <EstadoVacio icono={Inbox} titulo="Tu panel está listo" descripcion="Usa el menú para empezar. Los indicadores de cobros aparecen cuando el módulo está activo." />
        </Card>
      )}

      {datos && (
        <>
          {datos.alertas.map((a) => (
            <Aviso key={a.id} tipo="aviso" titulo="Tipo de cambio">
              {a.mensaje}
            </Aviso>
          ))}

          <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <TarjetaKpi titulo="Cobrado este mes" valor={formatoMoneda(datos.resumen.cobradoMesBob, "BOB")} testid="cobrado-mes" icono={TrendingUp} tono="exito" variacion={variacion} detalle={!variacion && "Pagos aprobados en Bs"} grafico={<MiniGrafico valores={datos.series.cobrado} />} />
            <TarjetaKpi titulo="Por cobrar" valor={monto(datos.resumen.porCobrar)} icono={CircleDollarSign} tono="primario" detalle={`${datos.series.cuotasPendientes} cuotas · próximos 6 meses`} grafico={<MiniGrafico valores={datos.series.porCobrar} tipo="barras" />} />
            <TarjetaKpi titulo="Vencido" valor={monto(datos.resumen.vencido)} icono={AlertTriangle} tono="peligro" detalle={`${datos.series.cuotasVencidas} cuotas · por antigüedad`} grafico={<MiniGrafico valores={datos.series.antiguedad} tipo="barras" />} />
            <TarjetaKpi
              titulo="En cola"
              valor={`${datos.resumen.planesEnCola} ${datos.resumen.planesEnCola === 1 ? "plan" : "planes"}`}
              icono={PauseCircle}
              tono="aviso"
              detalle={datos.resumen.planesEnCola ? "Pausados por atraso: escríbeles hoy" : "Ningún plan pausado"}
            />
          </section>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            <Card>
              <CardHeader
                acciones={
                  <Button asChild variant="ghost" size="sm">
                    <Link href="/panel/cobros/recordatorios">
                      Ver todo <ArrowRight />
                    </Link>
                  </Button>
                }
              >
                <CardTitle>Para recordar hoy</CardTitle>
                <CardDescription>Cuotas que vencen pronto, vencidas y en cola. El mensaje de WhatsApp ya va escrito.</CardDescription>
              </CardHeader>
              {datos.recordar.length === 0 ? (
                <EstadoVacio icono={PartyPopper} titulo="Todo al día" descripcion="No hay cuotas para recordar hoy." className="py-8" />
              ) : (
                <ul className="divide-y divide-border border-t border-border">
                  {datos.recordar.slice(0, 6).map((x) => (
                    <FilaRecordatorio key={x.cuotaId} x={x} />
                  ))}
                </ul>
              )}
              {datos.recordar.length > 6 && (
                <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
                  y {datos.recordar.length - 6} más en <Link className="font-medium text-primary hover:underline" href="/panel/cobros/recordatorios">Para recordar hoy</Link>
                </p>
              )}
            </Card>

            <div className="space-y-6">
              {ctx.puede("cobros:aprobar") && (
                <Card>
                  <CardHeader
                    acciones={
                      datos.resumen.comprobantesPorAprobar > 0 && (
                        <Button asChild variant="ghost" size="sm">
                          <Link href="/panel/cobros/pagos">
                            Ver todos <ArrowRight />
                          </Link>
                        </Button>
                      )
                    }
                  >
                    <CardTitle>Comprobantes por aprobar</CardTitle>
                    <CardDescription>{datos.resumen.comprobantesPorAprobar ? `${datos.resumen.comprobantesPorAprobar} esperando revisión` : "Nada pendiente"}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {datos.comprobantes.length === 0 && <p className="rounded-lg bg-surface-2 px-3 py-4 text-center text-sm text-muted-foreground">Cuando un cliente suba un comprobante aparecerá aquí.</p>}
                    {datos.comprobantes.map((c) => (
                      <div key={c.id} className="flex gap-3 rounded-lg border border-border p-3">
                        <a href={c.archivoId ? `/api/archivos/${c.archivoId}` : undefined} target="_blank" rel="noopener" className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-surface-2" aria-label={`Ver comprobante de ${c.cliente}`}>
                          {c.archivoId && c.mime?.startsWith("image/") ? (
                            // eslint-disable-next-line @next/next/no-img-element -- imagen privada servida por ruta autenticada
                            <img src={`/api/archivos/${c.archivoId}`} alt="" className="size-full object-cover" loading="lazy" />
                          ) : (
                            <FileText className="size-6 text-subtle-foreground" aria-hidden />
                          )}
                        </a>
                        <div className="min-w-0 flex-1 space-y-2">
                          <div>
                            <p className="truncate text-sm font-medium">{c.cliente}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              Cuota {c.numero} · {formatoMoneda(c.montoBobCentavos, "BOB")} · {formatoFecha(c.creadoEn)}
                            </p>
                          </div>
                          <RevisionPago pagoId={c.id} compacto />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
              <Card>
                <CardHeader>
                  <CardTitle>Tipo de cambio oficial</CardTitle>
                  <CardDescription>Banco Central de Bolivia · BRL → BOB</CardDescription>
                </CardHeader>
                <CardContent>
                  {datos.tc ? (
                    <div className="flex items-end justify-between gap-3">
                      <p className="text-2xl font-semibold tabular-nums">
                        Bs {Number(datos.tc.valor).toFixed(5)}
                        <span className="ml-1 text-sm font-normal text-muted-foreground">por R$ 1</span>
                      </p>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="size-3.5" aria-hidden /> {formatoFecha(datos.tc.fecha)}
                      </span>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Aún no hay cotizaciones guardadas.</p>
                  )}
                  {datos.tc && datos.tc.fecha !== hoy && <p className="mt-2 text-xs text-aviso">No hay cotización de hoy: se usa la última guardada.</p>}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
