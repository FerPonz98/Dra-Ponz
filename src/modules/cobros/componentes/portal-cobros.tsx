import { CalendarClock, CheckCircle2, Clock3, Landmark } from "lucide-react";
import { Aviso } from "@/components/ui/aviso";
import { formatoMoneda } from "@/lib/dinero";
import { formatoFecha } from "@/lib/fechas";
import { cn } from "@/lib/utils";
import type { DatosPortal } from "@/modules/cobros/servicios/portal";
import { BadgeCuota, BadgePago } from "./estado";
import { SubirComprobanteQr } from "./pago-qr";

function Tarjeta({ titulo, children, className }: { titulo?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-3xl border border-border bg-surface p-5 shadow-sm sm:p-6", className)}>
      {titulo && <h2 className="mb-4 text-lg font-semibold tracking-tight">{titulo}</h2>}
      {children}
    </section>
  );
}

/** Próxima cuota destacada + QR grande con el monto en Bs + "Ya pagué, subir comprobante". */
export function BloquePago({ d, qrUrl, datosBancarios, urlComprobante, titulo = "Tu próxima cuota" }: { d: DatosPortal; qrUrl: string | null; datosBancarios: string | null; urlComprobante: string; titulo?: string }) {
  if (!d.proxima) {
    const enRevision = d.cuotas.some((c) => c.pagoPendiente);
    return (
      <Tarjeta className={enRevision ? "border-info/30 bg-info-soft/50" : "border-exito/30 bg-exito-soft/50"}>
        <div className="flex items-start gap-3">
          {enRevision ? <Clock3 className="mt-0.5 size-6 shrink-0 text-info" aria-hidden /> : <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-exito" aria-hidden />}
          <div>
            <p className="font-semibold">{enRevision ? "¡Comprobante enviado! Te avisaremos cuando sea aprobado." : "No tienes cuotas pendientes. ¡Gracias!"}</p>
            <p className="mt-1 text-sm text-muted-foreground">{enRevision ? "Lo estamos revisando. Puedes cerrar esta página tranquilo." : "Estás al día con tu plan."}</p>
          </div>
        </div>
      </Tarjeta>
    );
  }
  const vence = d.cuotas.find((c) => c.id === d.proxima!.id)?.vencimiento ?? d.proxima.fechaVencimiento;
  return (
    <Tarjeta className="overflow-hidden p-0 sm:p-0">
      <div className="bg-primary px-5 pb-6 pt-5 text-primary-foreground sm:px-6">
        <p className="text-sm font-medium opacity-90">{titulo}</p>
        <p className="mt-1 flex items-center gap-1.5 text-sm opacity-90">
          <CalendarClock className="size-4" aria-hidden /> Cuota {d.proxima.numero} · vence el {formatoFecha(vence)}
        </p>
        {d.cobro && (
          <>
            <p className="mt-4 text-xs font-medium uppercase tracking-wider opacity-80">Monto exacto a pagar</p>
            <p className="text-4xl font-bold tracking-tight tabular-nums" data-testid="monto-bs">
              {formatoMoneda(d.cobro.montoBobCentavos, "BOB")}
            </p>
            {d.cobro.moneda === "BRL" && (
              <p className="mt-1 text-xs opacity-85">
                {formatoMoneda(d.cobro.montoCentavos, "BRL")} × tipo de cambio oficial {d.cobro.tipoCambio?.toFixed(5)} ({formatoFecha(d.cobro.tipoCambioFecha)})
              </p>
            )}
          </>
        )}
      </div>
      <div className="space-y-5 p-5 sm:p-6">
        {d.errorCobro && <Aviso tipo="error">{d.errorCobro}</Aviso>}
        <div className="text-center">
          <p className="mb-3 text-sm text-muted-foreground">Escanea este QR desde la app de tu banco y paga el monto exacto.</p>
          {qrUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- imagen privada servida por ruta con sesión de portal
            <img src={qrUrl} alt="Código QR para pagar" className="mx-auto aspect-square w-full max-w-72 rounded-2xl border border-border bg-white object-contain p-3 shadow-sm" />
          ) : (
            <Aviso tipo="aviso">Aún no hay un QR cargado. Usa los datos bancarios de abajo.</Aviso>
          )}
        </div>
        {datosBancarios && (
          <div className="flex gap-3 rounded-2xl bg-surface-2 p-4 text-sm">
            <Landmark className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
            <p className="whitespace-pre-line">{datosBancarios}</p>
          </div>
        )}
        <SubirComprobanteQr url={urlComprobante} cuotaId={d.proxima.id} />
      </div>
    </Tarjeta>
  );
}

export function TablaCuotasPortal({ d }: { d: DatosPortal }) {
  const pagadas = d.cuotas.filter((c) => c.estado === "pagada").length;
  return (
    <Tarjeta titulo="Tus cuotas">
      <div className="mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            {pagadas} de {d.cuotas.length} pagadas
          </span>
          <span className="font-medium tabular-nums">{formatoMoneda(d.total + d.totalRecargos, d.plan.moneda)}</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pagadas} aria-valuemin={0} aria-valuemax={d.cuotas.length} aria-label="Cuotas pagadas">
          <div className="h-full rounded-full bg-exito" style={{ width: `${d.cuotas.length ? (pagadas / d.cuotas.length) * 100 : 0}%` }} />
        </div>
      </div>
      <ul className="-mx-2 divide-y divide-border">
        {d.cuotas.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-3 px-2 py-3" data-testid={`portal-cuota-${c.numero}`}>
            <span className="flex items-center gap-3">
              <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold", c.estado === "pagada" ? "bg-exito-soft text-exito" : "bg-muted text-muted-foreground")}>{c.numero}</span>
              <span>
                <span className="block text-sm font-medium tabular-nums">{formatoMoneda(c.aPagarCentavos, d.plan.moneda)}</span>
                <span className="block text-xs text-muted-foreground">
                  {formatoFecha(c.vencimiento)}
                  {c.recargoCentavos > 0 && ` · incluye recargo ${formatoMoneda(c.recargoCentavos, d.plan.moneda)}`}
                </span>
              </span>
            </span>
            <BadgeCuota situacion={c.situacion} />
          </li>
        ))}
      </ul>
    </Tarjeta>
  );
}

export function HistorialPagosPortal({ d }: { d: DatosPortal }) {
  if (!d.pagos.length) return null;
  return (
    <Tarjeta titulo="Historial de pagos">
      <ul className="-mx-2 divide-y divide-border">
        {d.pagos.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 px-2 py-3">
            <span>
              <span className="block text-sm font-medium">
                Cuota {d.cuotas.find((c) => c.id === p.cuotaId)?.numero} · {formatoMoneda(p.montoBobCentavos, "BOB")}
              </span>
              <span className="block text-xs text-muted-foreground">{formatoFecha(p.creadoEn)}</span>
              {p.motivoRechazo && <span className="mt-1 block text-xs text-peligro">Motivo: {p.motivoRechazo}</span>}
            </span>
            <BadgePago estado={p.estado} />
          </li>
        ))}
      </ul>
    </Tarjeta>
  );
}

/** Portal de Cobros (clientes sin módulo vertical). */
export function PortalCobros({ d, qrUrl, datosBancarios, urlComprobante }: { d: DatosPortal; qrUrl: string | null; datosBancarios: string | null; urlComprobante: string }) {
  return (
    <div className="space-y-5">
      <div className="px-1">
        <p className="text-sm text-muted-foreground">Hola, {d.cliente.nombre.split(" ")[0]}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{d.plan.titulo}</h1>
      </div>
      {d.plan.estadoMora === "en_cola" && (
        <Aviso tipo="error" titulo="Tu plan está en pausa">
          Tienes una cuota atrasada. Cuando la pagues, retomamos con normalidad.
        </Aviso>
      )}
      {d.plan.estadoMora === "vencida" && (
        <Aviso tipo="aviso" titulo="Tienes una cuota vencida">
          Todavía estás dentro del plazo de gracia. Puedes pagarla ahora mismo.
        </Aviso>
      )}
      <BloquePago d={d} qrUrl={qrUrl} datosBancarios={datosBancarios} urlComprobante={urlComprobante} />
      <TablaCuotasPortal d={d} />
      <HistorialPagosPortal d={d} />
    </div>
  );
}

