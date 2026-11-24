import { FileText } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { hoyDe, requerirModulo } from "@/core/contexto";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineaTiempo } from "@/components/ui/linea-tiempo";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { BarraProgreso, EncabezadoPagina, Migas } from "@/components/ui/varios";
import { withOrg } from "@/lib/db";
import { formatoMoneda } from "@/lib/dinero";
import { formatoFecha } from "@/lib/fechas";
import { evaluarMora } from "@/modules/cobros/dominio/mora";
import { BadgeCuota, BadgeMora, BadgePago, ETIQUETA_MORA } from "@/modules/cobros/componentes/estado";
import { enlaceVigenteDePlan, urlPortal } from "@/modules/cobros/servicios/enlaces";
import { obtenerPlanCompleto } from "@/modules/cobros/servicios/planes";
import { BotonWhatsApp } from "@/modules/cobros/componentes/boton-whatsapp";
import { mensajeParaPlan } from "@/app/panel/cobros/mensajes";
import { EdicionPlan } from "./edicion-plan";
import { EnlacesPlan } from "./enlaces-plan";
import { BotonEliminar } from "@/components/panel/boton-eliminar";
import { accionEliminarPlan } from "@/app/panel/eliminar-acciones";
import { accionEliminarPago } from "../../acciones";

export default async function PlanPage(props: { params: Promise<{ id: string }> }) {
  const ctx = await requerirModulo("cobros", "cobros:ver");
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const hoy = hoyDe(ctx);
  const datos = await withOrg(ctx.organizacion.id, async (tx) => {
    const p = await obtenerPlanCompleto(tx, id);
    if (!p) return null;
    const enlace = await enlaceVigenteDePlan(tx, id);
    const mensaje = await mensajeParaPlan(tx, ctx, p, enlace?.token ? urlPortal(enlace.token) : null, hoy);
    return { p, enlace, mensaje };
  });
  if (!datos) notFound();
  const { p, enlace } = datos;
  const evaluacion = evaluarMora({ reglas: p.reglas, aceptadoEn: p.plan.aceptadoEn, numeroMoras: p.plan.numeroMoras, estadoMora: p.plan.estadoMora }, p.cuotas.map((c) => ({ ...c, pagoEnRevision: c.pagoPendiente })), hoy);
  const sit = new Map(evaluacion.cuotas.map((c) => [c.id, c]));
  const editable = ctx.puede("cobros:editar");
  const borrarPagos = ctx.puede("cobros:aprobar");
  const recargosPagados = p.cuotas.filter((c) => c.estado === "pagada").reduce((s, c) => s + c.recargoCentavos, 0);
  const saldo = p.total + p.totalRecargos - p.pagado - recargosPagados;
  const pct = p.total ? Math.round((p.pagado / p.total) * 100) : 0;
  const m = (v: number) => formatoMoneda(v, p.plan.moneda);

  return (
    <div>
      <EncabezadoPagina ayuda="cobros"
        migas={<Migas items={[{ etiqueta: "Planes de pago", href: "/panel/cobros/planes" }, { etiqueta: p.plan.titulo }]} />}
        titulo={p.plan.titulo}
        descripcion={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link href={`/panel/cobros/clientes/${p.cliente.id}`} className="font-medium text-foreground hover:text-primary">
              {p.cliente.nombre}
            </Link>
            <span aria-hidden>·</span> {p.plan.moneda === "BRL" ? "Reales (BRL)" : "Bolivianos (BOB)"}
            {p.plan.origen === "tesis" && (
              <>
                <span aria-hidden>·</span> Asesoría de tesis
              </>
            )}
            {p.plan.estado !== "activo" && (
              <>
                <span aria-hidden>·</span> {p.plan.estado}
              </>
            )}
          </span>
        }
        acciones={
          <>
            <BadgeMora estado={p.plan.estadoMora} />
            {datos.mensaje && <BotonWhatsApp numero={p.cliente.whatsapp} mensaje={datos.mensaje} size="default" />}
            {editable && p.plan.origen !== "tesis" && (
              <BotonEliminar
                etiqueta="Eliminar plan"
                titulo="¿Eliminar este plan de pagos?"
                descripcion={`Se borran sus ${p.cuotas.length} cuotas, los pagos, los comprobantes y el enlace del portal de ${p.cliente.nombre}. El cliente no se borra. No se puede deshacer.`}
                accion={accionEliminarPlan.bind(null, p.plan.id)}
              />
            )}
          </>
        }
      />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Cuotas</CardTitle>
              <CardDescription>
                {p.cuotas.filter((c) => c.estado === "pagada").length} de {p.cuotas.length} pagadas
              </CardDescription>
            </CardHeader>
            <Table>
              <THead>
                <TR>
                  <TH>#</TH>
                  <TH>Vence</TH>
                  <TH className="text-right">Monto</TH>
                  <TH className="text-right">Recargo</TH>
                  <TH>Estado</TH>
                </TR>
              </THead>
              <TBody>
                {p.cuotas.map((c) => {
                  const s = sit.get(c.id)!;
                  return (
                    <TR key={c.id} data-testid={`cuota-${c.numero}`}>
                      <TD className="font-medium tabular-nums">{c.numero}</TD>
                      <TD>
                        <span className="whitespace-nowrap">{formatoFecha(s.vencimiento)}</span>
                        {c.concepto && <span className="block text-xs text-muted-foreground">{c.concepto}</span>}
                        {s.diasAtraso > 0 && c.estado !== "pagada" && <span className="block text-xs font-medium text-peligro">{s.diasAtraso} días de atraso</span>}
                      </TD>
                      <TD className="text-right tabular-nums">{m(c.montoCentavos)}</TD>
                      <TD className="text-right tabular-nums">{c.recargoCentavos ? m(c.recargoCentavos) : <span className="text-subtle-foreground">—</span>}</TD>
                      <TD>
                        <BadgeCuota situacion={s.situacion} />
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </Card>

          {editable && (
            <EdicionPlan
              planId={p.plan.id}
              titulo={p.plan.titulo}
              moneda={p.plan.moneda}
              hoy={hoy}
              cuotas={p.cuotas.map((c) => ({ id: c.id, concepto: c.concepto, montoCentavos: c.montoCentavos, fechaVencimiento: c.fechaVencimiento, estado: c.estado }))}
              reglas={p.reglas}
            />
          )}

          <Card>
            <CardHeader>
              <CardTitle>Historial de cambios</CardTitle>
              <CardDescription>Quién cambió qué y cuándo.</CardDescription>
            </CardHeader>
            <CardContent>
              <LineaTiempo
                testid="historial"
                eventos={p.historial.map((h) => {
                  const legible = (v: string | null) => (v && h.campo === "estado de mora" && v in ETIQUETA_MORA ? ETIQUETA_MORA[v as keyof typeof ETIQUETA_MORA].texto : v);
                  return {
                  id: h.id,
                  fecha: formatoFecha(h.creadoEn),
                  autor: h.usuarioNombre,
                  titulo: <span className="first-letter:uppercase">{h.campo}</span>,
                  tono: h.campo.includes("estado de mora") ? (h.valorDespues === "al_dia" ? "exito" : "peligro") : h.campo.includes("aceptado") ? "primario" : "normal",
                  detalle:
                    h.valorAntes !== null || h.valorDespues !== null ? (
                      <>
                        {h.valorAntes !== null && <span className="line-through decoration-peligro/60">{legible(h.valorAntes)}</span>} {h.valorDespues !== null && <>→ {legible(h.valorDespues)}</>}
                      </>
                    ) : undefined,
                  };
                })}
              />
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6 xl:sticky xl:top-24">
          <Card>
            <CardHeader>
              <CardTitle>Resumen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-muted-foreground">Pagado</span>
                  <span className="text-sm font-medium tabular-nums">{pct}%</span>
                </div>
                <BarraProgreso valor={pct} etiqueta={`Pagado ${pct}%`} className="mt-1.5" />
              </div>
              <dl className="grid grid-cols-2 gap-3">
                {[
                  ["Total", m(p.total)],
                  ["Pagado", m(p.pagado)],
                  ["Recargos", m(p.totalRecargos)],
                  ["Saldo", m(saldo)],
                ].map(([t, v]) => (
                  <div key={t} className="rounded-lg bg-surface-2 p-3">
                    <dt className="text-xs text-muted-foreground">{t}</dt>
                    <dd className="mt-0.5 font-semibold tabular-nums">{v}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>

          {editable && (
            <EnlacesPlan
              planId={p.plan.id}
              tieneCi={!!p.cliente.ci}
              vigente={enlace?.token ? { id: enlace.id, url: urlPortal(enlace.token), metodo: enlace.metodo, expiraEn: enlace.expiraEn?.toISOString() ?? null } : null}
              whatsapp={p.cliente.whatsapp}
            />
          )}

          <Card>
            <CardHeader>
              <CardTitle>Pagos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {p.pagos.length === 0 && <p className="text-sm text-muted-foreground">Todavía no hay pagos registrados.</p>}
              {p.pagos.map((pg) => (
                <div key={pg.id} className="rounded-lg border border-border p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">
                      Cuota {p.cuotas.find((c) => c.id === pg.cuotaId)?.numero ?? "?"} · {formatoMoneda(pg.montoBobCentavos, "BOB")}
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      <BadgePago estado={pg.estado} />
                      {borrarPagos && (
                        <BotonEliminar
                          compacto
                          etiqueta="Eliminar comprobante"
                          titulo="¿Eliminar este comprobante?"
                          descripcion={
                            pg.estado === "aprobado"
                              ? "Se borra este pago aprobado y su archivo. La cuota vuelve a quedar pendiente de pago y se recalcula la mora. No se puede deshacer."
                              : "Se borra este comprobante y su archivo. No se puede deshacer."
                          }
                          accion={accionEliminarPago.bind(null, pg.id)}
                        />
                      )}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatoFecha(pg.creadoEn)}
                    {pg.tipoCambio && ` · TC ${Number(pg.tipoCambio).toFixed(5)} (${formatoFecha(pg.tipoCambioFecha)})`}
                  </p>
                  {pg.motivoRechazo && <p className="mt-1 text-xs text-peligro">Motivo: {pg.motivoRechazo}</p>}
                  {pg.comprobanteArchivoId && (
                    <a href={`/api/archivos/${pg.comprobanteArchivoId}`} target="_blank" rel="noopener" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                      <FileText className="size-3.5" aria-hidden /> Ver comprobante
                    </a>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
