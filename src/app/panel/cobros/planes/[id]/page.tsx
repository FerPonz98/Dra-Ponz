import Link from "next/link";
import { notFound } from "next/navigation";
import { hoyDe, requerirModulo } from "@/core/contexto";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { withOrg } from "@/lib/db";
import { formatoMoneda } from "@/lib/dinero";
import { formatoFecha } from "@/lib/fechas";
import { evaluarMora } from "@/modules/cobros/dominio/mora";
import { BadgeCuota, BadgeMora, BadgePago } from "@/modules/cobros/componentes/estado";
import { enlaceVigenteDePlan, urlPortal } from "@/modules/cobros/servicios/enlaces";
import { obtenerPlanCompleto } from "@/modules/cobros/servicios/planes";
import { BotonWhatsApp } from "@/modules/cobros/componentes/boton-whatsapp";
import { mensajeParaPlan } from "@/app/panel/cobros/mensajes";
import { EdicionPlan } from "./edicion-plan";
import { EnlacesPlan } from "./enlaces-plan";

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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{p.plan.titulo}</h1>
          <p className="text-sm text-muted-foreground">
            <Link href={`/panel/cobros/clientes/${p.cliente.id}`} className="hover:underline">
              {p.cliente.nombre}
            </Link>{" "}
            · {p.plan.moneda} · {p.plan.estado}
            {p.plan.origen ? ` · origen: ${p.plan.origen}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BadgeMora estado={p.plan.estadoMora} />
          {datos.mensaje && <BotonWhatsApp numero={p.cliente.whatsapp} mensaje={datos.mensaje} />}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Total", formatoMoneda(p.total, p.plan.moneda)],
          ["Pagado", formatoMoneda(p.pagado, p.plan.moneda)],
          ["Recargos", formatoMoneda(p.totalRecargos, p.plan.moneda)],
          ["Saldo", formatoMoneda(p.total + p.totalRecargos - p.pagado - p.cuotas.filter((c) => c.estado === "pagada").reduce((s, c) => s + c.recargoCentavos, 0), p.plan.moneda)],
        ].map(([t, v]) => (
          <Card key={t}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{t}</p>
              <p className="text-lg font-semibold">{v}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cuotas</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>#</TH>
                <TH>Vence</TH>
                <TH>Monto</TH>
                <TH>Recargo</TH>
                <TH>Estado</TH>
              </TR>
            </THead>
            <TBody>
              {p.cuotas.map((c) => {
                const s = sit.get(c.id)!;
                return (
                  <TR key={c.id} data-testid={`cuota-${c.numero}`}>
                    <TD>{c.numero}</TD>
                    <TD>
                      {formatoFecha(s.vencimiento)}
                      {s.diasAtraso > 0 && c.estado !== "pagada" && <span className="block text-xs text-red-700">{s.diasAtraso} días de atraso</span>}
                    </TD>
                    <TD>{formatoMoneda(c.montoCentavos, p.plan.moneda)}</TD>
                    <TD>{c.recargoCentavos ? formatoMoneda(c.recargoCentavos, p.plan.moneda) : "—"}</TD>
                    <TD>
                      <BadgeCuota situacion={s.situacion} />
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </CardContent>
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
          {p.pagos.length === 0 && <p className="text-sm text-muted-foreground">Sin pagos registrados.</p>}
          {p.pagos.map((pg) => (
            <div key={pg.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
              <span>
                Cuota {p.cuotas.find((c) => c.id === pg.cuotaId)?.numero ?? "?"} · {formatoMoneda(pg.montoBobCentavos, "BOB")}
                {pg.tipoCambio && ` (TC ${Number(pg.tipoCambio).toFixed(5)} del ${formatoFecha(pg.tipoCambioFecha)})`} · {formatoFecha(pg.creadoEn)}
                {pg.motivoRechazo && <span className="block text-xs text-red-700">Motivo: {pg.motivoRechazo}</span>}
              </span>
              <span className="flex items-center gap-2">
                {pg.comprobanteArchivoId && (
                  <a href={`/api/archivos/${pg.comprobanteArchivoId}`} target="_blank" rel="noopener" className="text-primary underline">
                    Comprobante
                  </a>
                )}
                <BadgePago estado={pg.estado} />
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historial de cambios</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1 text-sm" data-testid="historial">
            {p.historial.map((h) => (
              <li key={h.id} className="border-b py-1 last:border-0">
                <span className="text-muted-foreground">{formatoFecha(h.creadoEn)} · {h.usuarioNombre ?? "—"}:</span> <strong>{h.campo}</strong>{" "}
                {h.valorAntes !== null && <span className="line-through decoration-red-500">{h.valorAntes}</span>} {h.valorDespues !== null && <>→ {h.valorDespues}</>}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
