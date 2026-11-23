import { Check, FileDown, GraduationCap, Sparkles } from "lucide-react";
import type { Resultado } from "@/lib/acciones";
import { Aviso } from "@/components/ui/aviso";
import { Button } from "@/components/ui/button";
import { formatoMoneda } from "@/lib/dinero";
import { formatoFecha } from "@/lib/fechas";
import { cn } from "@/lib/utils";
import { BloquePago, HistorialPagosPortal, TablaCuotasPortal } from "@/modules/cobros/componentes/portal-cobros";
import type { DatosPortal } from "@/modules/cobros/servicios/portal";
import { avance, mesActual, rangoMes } from "@/modules/tesis/dominio/cronograma";
import { ETIQUETA_ESTADO } from "@/modules/tesis/dominio/estados";
import type { Proyecto } from "@/modules/tesis/servicios/propuestas";
import { BotonPortal } from "./boton-portal";

export type AccionesPortalTesis = { aceptar: () => Promise<Resultado>; aceptarCronograma: () => Promise<Resultado> };
export type ExtrasPortalTesis = { formulario?: React.ReactNode; archivos?: React.ReactNode; solicitudes?: React.ReactNode };

export function TarjetaPortal({ titulo, paso, children, className }: { titulo: string; paso?: number; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-3xl border border-border bg-surface p-5 shadow-sm sm:p-6", className)}>
      <h2 className="mb-4 flex items-center gap-2.5 text-lg font-semibold tracking-tight">
        {paso && <span className="flex size-7 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary">{paso}</span>}
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function TablaCronograma({ cr, mes }: { cr: NonNullable<Proyecto["vigente"]>; mes?: number }) {
  const meses = Array.from({ length: cr.meses }, (_, i) => i + 1);
  return (
    <div className="relative -mx-1 overflow-x-auto px-1" tabIndex={0} role="region" aria-label="Cronograma de actividades por mes">
      <table className="w-full min-w-[26rem] border-separate border-spacing-0 text-xs">
        <thead>
          <tr>
            <th className="border-b border-border pb-2 text-left font-medium text-muted-foreground">Actividad</th>
            {meses.map((m) => (
              <th key={m} className={cn("w-9 border-b border-border pb-2 text-center font-medium text-muted-foreground", m === mes && "text-primary")} title={`${formatoFecha(rangoMes(cr.fechaInicio, m).desde)} – ${formatoFecha(rangoMes(cr.fechaInicio, m).hasta)}`}>
                M{m}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cr.actividades.map((a) => (
            <tr key={a.id}>
              <td className="border-b border-border py-2 pr-2">
                <span className={a.hecha ? "text-muted-foreground line-through" : ""}>{a.nombre}</span>
                {a.aCargoEstudiante && <span className="text-muted-foreground"> (a tu cargo)</span>}
              </td>
              {meses.map((m) => (
                <td key={m} className={cn("border-b border-border py-2 text-center", m === mes && "bg-primary-soft/60")}>
                  {a.meses.includes(m) && (
                    <>
                      <span aria-hidden className={cn("mx-auto block h-2 w-6 rounded-full", a.hecha ? "bg-exito" : "bg-primary")} />
                      <span className="sr-only">sí</span>
                    </>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Portal del estudiante: pasos guiados sobre el portal de Cobros. */
export function PortalTesis({ p, d, token, qrUrl, datosBancarios, urlComprobante, acciones, hoy, extras }: { p: Proyecto; d: DatosPortal; token: string; qrUrl: string | null; datosBancarios: string | null; urlComprobante: string; acciones: AccionesPortalTesis; hoy: string; extras?: ExtrasPortalTesis }) {
  const pr = p.propuesta;
  const moneda = p.plan.plan.moneda;
  const aceptada = !!pr.aceptadaEn;
  const primeraPagada = d.cuotas[0]?.estado === "pagada";
  const primeraEnRevision = !!d.cuotas[0]?.pagoPendiente;
  const formularioListo = !pr.formularioId || p.respuestas.length > 0;
  const pasos = [
    { titulo: "Aceptar", hecho: aceptada },
    { titulo: "Pagar", hecho: primeraPagada || primeraEnRevision },
    { titulo: "Formulario", hecho: aceptada && formularioListo },
    { titulo: "Archivos", hecho: p.archivos.some((a) => a.origen === "estudiante") },
    { titulo: "Avance", hecho: false },
  ];
  const actual = pasos.findIndex((s) => !s.hecho);
  const cr = p.vigente;
  const pct = cr ? avance(cr.actividades) : 0;
  const mes = cr ? mesActual(cr.fechaInicio, hoy, cr.meses) : 0;
  const delMes = cr && mes >= 1 && mes <= cr.meses ? cr.actividades.filter((a) => a.meses.includes(mes)) : [];
  const proxima = d.cuotas.find((c) => c.estado === "pendiente");
  const nombre = p.cliente.nombre.split(" ")[0];

  return (
    <div className="space-y-5">
      <div className="px-1">
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <GraduationCap className="size-4" aria-hidden /> Asesoría de tesis
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-balance">{pr.titulo}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Hola, {nombre} · Estado: <strong className="font-medium text-foreground" data-testid="estado-portal">{ETIQUETA_ESTADO[pr.estado]}</strong>
        </p>
      </div>

      <nav aria-label="Tus pasos" className="rounded-3xl border border-border bg-surface p-4 shadow-sm">
        <ol className="flex items-start justify-between">
          {pasos.map((s, i) => (
            <li key={s.titulo} className="relative flex flex-1 flex-col items-center text-center" aria-current={i === actual ? "step" : undefined}>
              {i > 0 && <span aria-hidden className={cn("absolute right-1/2 top-4 h-0.5 w-full -translate-y-1/2", pasos[i - 1].hecho ? "bg-exito" : "bg-border")} />}
              <span
                className={cn(
                  "relative z-10 flex size-8 items-center justify-center rounded-full border-2 text-sm font-semibold",
                  s.hecho ? "border-exito bg-exito text-white dark:text-black" : i === actual ? "border-primary bg-surface text-primary" : "border-border bg-surface text-muted-foreground",
                )}
              >
                {s.hecho ? <Check className="size-4" aria-label="completo" /> : i + 1}
              </span>
              <span className={cn("mt-1.5 text-[11px] font-medium leading-tight", i === actual ? "text-foreground" : "text-muted-foreground")}>{s.titulo}</span>
            </li>
          ))}
        </ol>
      </nav>

      {pr.estado === "en_cola" && (
        <Aviso tipo="error" titulo="Tu proyecto está en pausa">
          Hay una cuota atrasada. Cuando la regularices, la asesora te enviará un cronograma nuevo y seguimos.
        </Aviso>
      )}

      {!aceptada && (
        <TarjetaPortal titulo="1. Revisa tu propuesta">
          <div className="space-y-5 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-surface-2 p-4">
                <p className="text-xs text-muted-foreground">Inversión total</p>
                <p className="mt-0.5 text-lg font-semibold tabular-nums">{formatoMoneda(p.plan.total, moneda)}</p>
                <p className="text-xs text-muted-foreground">en {p.plan.cuotas.length} cuotas</p>
              </div>
              <div className="rounded-2xl bg-surface-2 p-4">
                <p className="text-xs text-muted-foreground">Nivel</p>
                <p className="mt-0.5 text-lg font-semibold">{pr.nivel === "posgrado" ? "Posgrado" : "Pregrado"}</p>
                {pr.universidad && <p className="truncate text-xs text-muted-foreground">{pr.universidad}</p>}
              </div>
            </div>
            {pr.expiraEn && <p className="text-muted-foreground">Esta propuesta está vigente hasta el {formatoFecha(pr.expiraEn)}.</p>}
            <TablaCuotasPortal d={d} />
            {cr && (
              <div>
                <p className="mb-2 font-medium">Cronograma</p>
                <TablaCronograma cr={cr} />
              </div>
            )}
            <ul className="space-y-2">
              <li className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-exito" aria-hidden /> Incluye 2 revisiones del tribunal. 3.ª revisión aparte: {formatoMoneda(pr.precioTerceraRevisionCentavos, moneda)}.
              </li>
              {p.extras.length > 0 && (
                <li className="flex gap-2">
                  <Sparkles className="mt-0.5 size-4 shrink-0 text-aviso" aria-hidden /> Extras opcionales: {p.extras.map((x) => `${x.nombre} (${formatoMoneda(x.precioCentavos, moneda)})`).join(", ")}.
                </li>
              )}
            </ul>
            <Button asChild variant="outline" className="w-full">
              <a href={`/p/${token}/propuesta.pdf`} target="_blank" rel="noopener">
                <FileDown /> Descargar PDF
              </a>
            </Button>
            <BotonPortal
              etiqueta="Acepto la propuesta"
              grande
              accion={acciones.aceptar}
              confirmar="¿Aceptas la propuesta?"
              descripcion="Confirmas el plan de pagos y el cronograma. Después podrás pagar la primera cuota."
              textoConfirmar="Sí, acepto"
            />
          </div>
        </TarjetaPortal>
      )}

      {aceptada && (
        <p className="flex items-center gap-2 px-1 text-sm text-muted-foreground" data-testid="aceptada-portal">
          <Check className="size-4 text-exito" aria-hidden />
          Aceptaste la propuesta el {formatoFecha(pr.aceptadaEn)}.
          <a className="font-medium text-primary underline" href={`/p/${token}/propuesta.pdf`} target="_blank" rel="noopener">
            Ver PDF
          </a>
        </p>
      )}

      {aceptada && p.nuevoPendiente && (
        <TarjetaPortal titulo="Nuevo cronograma" className="border-aviso/40">
          <div className="space-y-4 text-sm">
            <p>La asesora preparó un cronograma nuevo desde el {formatoFecha(p.nuevoPendiente.fechaInicio)}. Revísalo y acéptalo para continuar.</p>
            <TablaCronograma cr={p.nuevoPendiente} />
            <BotonPortal etiqueta="Acepto el nuevo cronograma" grande accion={acciones.aceptarCronograma} />
          </div>
        </TarjetaPortal>
      )}

      {aceptada && <BloquePago d={d} qrUrl={qrUrl} datosBancarios={datosBancarios} urlComprobante={urlComprobante} titulo={primeraPagada ? "Tu próxima cuota" : "2. Paga la primera cuota con QR"} />}

      {aceptada && extras?.formulario}
      {aceptada && extras?.archivos}

      {aceptada && cr && (
        <TarjetaPortal titulo="5. Tu avance">
          <div className="space-y-5 text-sm">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="h-3 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Avance del proyecto">
                  <div className="h-full rounded-full bg-primary transition-[width] duration-700" style={{ width: `${pct}%` }} />
                </div>
              </div>
              <p className="shrink-0 font-semibold tabular-nums" data-testid="avance-portal">
                {pct}% completado
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-surface-2 p-4">
                <p className="text-xs font-medium text-muted-foreground">Este mes{mes >= 1 && mes <= cr.meses ? ` (mes ${mes})` : ""}</p>
                <p className="mt-1">{delMes.length ? delMes.map((a) => a.nombre).join(", ") : mes === 0 ? "El cronograma aún no empieza." : "¡Cronograma completado!"}</p>
              </div>
              <div className="rounded-2xl bg-surface-2 p-4">
                <p className="text-xs font-medium text-muted-foreground">Próxima cuota:</p>
                <p className="mt-1">{proxima ? `${formatoMoneda(proxima.aPagarCentavos, moneda)} · ${formatoFecha(proxima.vencimiento)}` : "Ninguna pendiente"}</p>
              </div>
            </div>
            <p>
              <span className="font-medium">Revisiones del tribunal:</span> {p.revisiones.map((r) => `${r.numero}.ª ${r.estado}`).join(" · ")}
            </p>
            <TablaCronograma cr={cr} mes={mes} />
          </div>
        </TarjetaPortal>
      )}
      {aceptada && extras?.solicitudes}
      {aceptada && <TablaCuotasPortal d={d} />}
      {aceptada && <HistorialPagosPortal d={d} />}
    </div>
  );
}
