import Link from "next/link";
import { hoyDe, requerirOrganizacion } from "@/core/contexto";
import { Aviso } from "@/components/ui/aviso";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { withOrg } from "@/lib/db";
import { formatoMoneda } from "@/lib/dinero";
import { formatoFecha } from "@/lib/fechas";
import { recordatoriosDeHoy, resumenPanel } from "@/modules/cobros/servicios/panel";
import { alertasActivas, ultimasCotizaciones } from "@/modules/cobros/servicios/tipo-cambio";

export default async function PanelPage() {
  const ctx = await requerirOrganizacion();
  const hoy = hoyDe(ctx);
  const cobros = ctx.modulos.includes("cobros") && ctx.puede("cobros:ver");
  const datos = cobros
    ? await withOrg(ctx.organizacion.id, async (tx) => ({
        resumen: await resumenPanel(tx, hoy, ctx.organizacion.zonaHoraria),
        recordar: await recordatoriosDeHoy(tx, hoy),
        alertas: await alertasActivas(tx),
        tc: (await ultimasCotizaciones(tx, 1))[0] ?? null,
      }))
    : null;

  const monto = (m: { BOB: number; BRL: number }) => (
    <>
      {formatoMoneda(m.BOB, "BOB")}
      {m.BRL > 0 && <span className="block text-sm font-normal">{formatoMoneda(m.BRL, "BRL")}</span>}
    </>
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Hola, {ctx.usuario.nombre}</h1>
      <p className="text-sm text-muted-foreground">
        {ctx.organizacion.nombre} · Módulos activos: {ctx.modulos.join(", ") || "ninguno"}
      </p>
      {datos && (
        <>
          {datos.alertas.map((a) => (
            <Aviso key={a.id} tipo="aviso">
              {a.mensaje}
            </Aviso>
          ))}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Cobrado este mes</p>
                <p className="text-xl font-semibold" data-testid="cobrado-mes">
                  {formatoMoneda(datos.resumen.cobradoMesBob, "BOB")}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Por cobrar</p>
                <p className="text-xl font-semibold">{monto(datos.resumen.porCobrar)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Vencido</p>
                <p className="text-xl font-semibold text-red-700">{monto(datos.resumen.vencido)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Planes en cola</p>
                <p className="text-xl font-semibold">{datos.resumen.planesEnCola}</p>
              </CardContent>
            </Card>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Pendientes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Link href="/panel/cobros/pagos" className="flex justify-between rounded-md border p-3 hover:bg-muted">
                  <span>Comprobantes por aprobar</span>
                  <strong>{datos.resumen.comprobantesPorAprobar}</strong>
                </Link>
                <Link href="/panel/cobros/recordatorios" className="flex justify-between rounded-md border p-3 hover:bg-muted">
                  <span>Para recordar hoy</span>
                  <strong>{datos.recordar.length}</strong>
                </Link>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Tipo de cambio oficial (BCB)</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                {datos.tc ? (
                  <p>
                    1 BRL = <strong>Bs {Number(datos.tc.valor).toFixed(5)}</strong> · {formatoFecha(datos.tc.fecha)}
                    {datos.tc.fecha !== hoy && <span className="block text-amber-700">No hay cotización de hoy: se usa la última guardada.</span>}
                  </p>
                ) : (
                  <p className="text-muted-foreground">Aún no hay cotizaciones guardadas.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
