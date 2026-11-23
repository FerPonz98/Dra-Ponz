import type { Resultado } from "@/lib/acciones";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Aviso } from "@/components/ui/aviso";
import { formatoMoneda } from "@/lib/dinero";
import { formatoFecha } from "@/lib/fechas";
import type { DatosPortal } from "@/modules/cobros/servicios/portal";
import { BadgeCuota, BadgePago } from "./estado";
import { SubirComprobante } from "./subir-comprobante";

type Accion = (estado: Resultado | null, fd: FormData) => Promise<Resultado>;

/** Bloque de pago: QR estático + monto exacto en Bs + subida del comprobante. */
export function BloquePago({ d, qrUrl, datosBancarios, accionSubir, titulo = "Pagar con QR" }: { d: DatosPortal; qrUrl: string | null; datosBancarios: string | null; accionSubir: Accion; titulo?: string }) {
  if (!d.proxima) {
    const enRevision = d.cuotas.some((c) => c.pagoPendiente);
    return <Aviso tipo={enRevision ? "info" : "exito"}>{enRevision ? "Tu comprobante está en revisión." : "No tienes cuotas pendientes. ¡Gracias!"}</Aviso>;
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>{titulo}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p>
          Cuota {d.proxima.numero} · vence {formatoFecha(d.cuotas.find((c) => c.id === d.proxima!.id)?.vencimiento ?? d.proxima.fechaVencimiento)}
        </p>
        {d.errorCobro && <Aviso tipo="error">{d.errorCobro}</Aviso>}
        {d.cobro && (
          <div className="rounded-lg bg-muted p-4 text-center">
            <p className="text-sm text-muted-foreground">Monto exacto a pagar</p>
            <p className="text-3xl font-bold" data-testid="monto-bs">
              {formatoMoneda(d.cobro.montoBobCentavos, "BOB")}
            </p>
            {d.cobro.moneda === "BRL" && (
              <p className="mt-1 text-xs text-muted-foreground">
                {formatoMoneda(d.cobro.montoCentavos, "BRL")} × tipo de cambio oficial BCB {d.cobro.tipoCambio?.toFixed(5)} ({formatoFecha(d.cobro.tipoCambioFecha)})
              </p>
            )}
          </div>
        )}
        {qrUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- imagen privada servida por ruta con sesión de portal
          <img src={qrUrl} alt="Código QR para pagar" className="mx-auto h-56 w-56 rounded border object-contain" />
        ) : (
          <Aviso tipo="aviso">El negocio aún no cargó su QR. Consulta los datos bancarios.</Aviso>
        )}
        {datosBancarios && <p className="whitespace-pre-line text-sm">{datosBancarios}</p>}
        <SubirComprobante cuotaId={d.proxima.id} accion={accionSubir} />
      </CardContent>
    </Card>
  );
}

export function TablaCuotasPortal({ d }: { d: DatosPortal }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tus cuotas</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {d.cuotas.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-2 text-sm" data-testid={`portal-cuota-${c.numero}`}>
              <span>
                <strong>Cuota {c.numero}</strong> · {formatoFecha(c.vencimiento)}
                <span className="block text-muted-foreground">
                  {formatoMoneda(c.aPagarCentavos, d.plan.moneda)}
                  {c.recargoCentavos > 0 && ` (incluye recargo ${formatoMoneda(c.recargoCentavos, d.plan.moneda)})`}
                </span>
              </span>
              <BadgeCuota situacion={c.situacion} />
            </li>
          ))}
        </ul>
        <p className="mt-3 text-right text-sm">
          Total: <strong>{formatoMoneda(d.total + d.totalRecargos, d.plan.moneda)}</strong>
        </p>
      </CardContent>
    </Card>
  );
}

export function HistorialPagosPortal({ d }: { d: DatosPortal }) {
  if (!d.pagos.length) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Historial de pagos</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y text-sm">
          {d.pagos.map((p) => (
            <li key={p.id} className="flex items-center justify-between py-2">
              <span>
                Cuota {d.cuotas.find((c) => c.id === p.cuotaId)?.numero} · {formatoMoneda(p.montoBobCentavos, "BOB")} · {formatoFecha(p.creadoEn)}
                {p.motivoRechazo && <span className="block text-xs text-red-700">Motivo: {p.motivoRechazo}</span>}
              </span>
              <BadgePago estado={p.estado} />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/** Portal de Cobros completo (clientes sin módulo vertical). */
export function PortalCobros({ d, qrUrl, datosBancarios, accionSubir }: { d: DatosPortal; qrUrl: string | null; datosBancarios: string | null; accionSubir: Accion }) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">{d.plan.titulo}</h1>
        <p className="text-sm text-muted-foreground">Hola, {d.cliente.nombre}</p>
      </div>
      {d.plan.estadoMora === "en_cola" && <Aviso tipo="error">Tu plan está en pausa por una cuota atrasada. Regulariza el pago para continuar.</Aviso>}
      {d.plan.estadoMora === "vencida" && <Aviso tipo="aviso">Tienes una cuota vencida. Aún estás dentro del plazo de gracia.</Aviso>}
      <BloquePago d={d} qrUrl={qrUrl} datosBancarios={datosBancarios} accionSubir={accionSubir} />
      <TablaCuotasPortal d={d} />
      <HistorialPagosPortal d={d} />
    </div>
  );
}
