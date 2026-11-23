import { Check } from "lucide-react";
import type { Resultado } from "@/lib/acciones";
import { Aviso } from "@/components/ui/aviso";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatoMoneda } from "@/lib/dinero";
import { formatoFecha } from "@/lib/fechas";
import { cn } from "@/lib/utils";
import { BloquePago, HistorialPagosPortal, TablaCuotasPortal } from "@/modules/cobros/componentes/portal-cobros";
import type { DatosPortal } from "@/modules/cobros/servicios/portal";
import { avance, mesActual, rangoMes } from "@/modules/tesis/dominio/cronograma";
import { ETIQUETA_ESTADO } from "@/modules/tesis/dominio/estados";
import type { Proyecto } from "@/modules/tesis/servicios/propuestas";
import { BotonPortal } from "./boton-portal";

type Accion = (estado: Resultado | null, fd: FormData) => Promise<Resultado>;

export type AccionesPortalTesis = {
  aceptar: () => Promise<Resultado>;
  aceptarCronograma: () => Promise<Resultado>;
  subirComprobante: Accion;
};

export type ExtrasPortalTesis = { formulario?: React.ReactNode; archivos?: React.ReactNode; solicitudes?: React.ReactNode };

function TablaCronograma({ cr }: { cr: NonNullable<Proyecto["vigente"]> }) {
  const meses = Array.from({ length: cr.meses }, (_, i) => i + 1);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[28rem] text-xs">
        <thead>
          <tr className="border-b">
            <th className="p-1 text-left">Actividad</th>
            {meses.map((m) => (
              <th key={m} className="p-1 text-center" title={`${formatoFecha(rangoMes(cr.fechaInicio, m).desde)} – ${formatoFecha(rangoMes(cr.fechaInicio, m).hasta)}`}>
                M{m}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cr.actividades.map((a) => (
            <tr key={a.id} className="border-b last:border-0">
              <td className="p-1">
                {a.nombre}
                {a.aCargoEstudiante && <span className="text-muted-foreground"> (a tu cargo)</span>}
              </td>
              {meses.map((m) => (
                <td key={m} className="p-1 text-center">
                  {a.meses.includes(m) ? <span className={cn("inline-block size-3 rounded-sm", a.hecha ? "bg-emerald-600" : "bg-primary")} aria-label="sí" /> : ""}
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
export function PortalTesis({ p, d, token, qrUrl, datosBancarios, acciones, hoy, extras }: { p: Proyecto; d: DatosPortal; token: string; qrUrl: string | null; datosBancarios: string | null; acciones: AccionesPortalTesis; hoy: string; extras?: ExtrasPortalTesis }) {
  const pr = p.propuesta;
  const moneda = p.plan.plan.moneda;
  const aceptada = !!pr.aceptadaEn;
  const primeraPagada = d.cuotas[0]?.estado === "pagada";
  const primeraEnRevision = d.cuotas[0]?.pagoPendiente;
  const formularioListo = !pr.formularioId || p.respuestas.length > 0;
  const pasos = [
    { titulo: "Revisar y aceptar", hecho: aceptada },
    { titulo: "Pagar la 1.ª cuota", hecho: primeraPagada || !!primeraEnRevision },
    { titulo: "Llenar el formulario", hecho: aceptada && formularioListo },
    { titulo: "Subir archivos", hecho: p.archivos.some((a) => a.origen === "estudiante") },
    { titulo: "Ver avance", hecho: false },
  ];
  const cr = p.vigente;
  const pct = cr ? avance(cr.actividades) : 0;
  const mes = cr ? mesActual(cr.fechaInicio, hoy, cr.meses) : 0;
  const delMes = cr && mes >= 1 && mes <= cr.meses ? cr.actividades.filter((a) => a.meses.includes(mes)) : [];
  const proxima = d.cuotas.find((c) => c.estado === "pendiente");

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Asesoría de tesis</p>
        <h1 className="text-xl font-semibold">{pr.titulo}</h1>
        <p className="text-sm text-muted-foreground">
          Hola, {p.cliente.nombre} · Estado: <strong data-testid="estado-portal">{ETIQUETA_ESTADO[pr.estado]}</strong>
        </p>
      </div>

      <ol className="grid grid-cols-5 gap-1" aria-label="Pasos">
        {pasos.map((s, i) => (
          <li key={s.titulo} className="text-center">
            <span className={cn("mx-auto flex size-8 items-center justify-center rounded-full border text-sm font-semibold", s.hecho ? "border-emerald-600 bg-emerald-600 text-white" : "bg-background")}>
              {s.hecho ? <Check className="size-4" aria-label="completo" /> : i + 1}
            </span>
            <span className="mt-1 block text-[11px] leading-tight">{s.titulo}</span>
          </li>
        ))}
      </ol>

      {pr.estado === "en_cola" && <Aviso tipo="error">Tu proyecto está en pausa por una cuota atrasada. Al regularizar el pago, la asesora te enviará un cronograma nuevo.</Aviso>}

      {/* Paso 1: revisar y aceptar */}
      {!aceptada && (
        <Card>
          <CardHeader>
            <CardTitle>1. Revisa tu propuesta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p>
              {pr.nivel === "posgrado" ? "Posgrado" : "Pregrado"}
              {pr.universidad ? ` · ${pr.universidad}` : ""} · Total <strong>{formatoMoneda(p.plan.total, moneda)}</strong> en {p.plan.cuotas.length} cuotas
            </p>
            {pr.expiraEn && <p className="text-muted-foreground">Esta propuesta está vigente hasta el {formatoFecha(pr.expiraEn)}.</p>}
            <TablaCuotasPortal d={d} />
            {cr && <TablaCronograma cr={cr} />}
            <p>Incluye 2 revisiones del tribunal. 3.ª revisión aparte: {formatoMoneda(pr.precioTerceraRevisionCentavos, moneda)}.</p>
            {p.extras.length > 0 && <p>Extras opcionales: {p.extras.map((x) => `${x.nombre} (${formatoMoneda(x.precioCentavos, moneda)})`).join(", ")}.</p>}
            <Button asChild variant="outline" size="sm">
              <a href={`/p/${token}/propuesta.pdf`} target="_blank" rel="noopener">
                Descargar PDF
              </a>
            </Button>
            <BotonPortal etiqueta="Acepto la propuesta" accion={acciones.aceptar} confirmar="¿Confirmas que aceptas la propuesta y su plan de pagos?" />
          </CardContent>
        </Card>
      )}

      {aceptada && (
        <p className="text-sm text-muted-foreground" data-testid="aceptada-portal">
          Aceptaste la propuesta el {formatoFecha(pr.aceptadaEn)}.{" "}
          <a className="underline" href={`/p/${token}/propuesta.pdf`} target="_blank" rel="noopener">
            Ver PDF
          </a>
        </p>
      )}

      {/* Nuevo cronograma por aceptar */}
      {aceptada && p.nuevoPendiente && (
        <Card>
          <CardHeader>
            <CardTitle>Nuevo cronograma</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>La asesora preparó un cronograma nuevo desde el {formatoFecha(p.nuevoPendiente.fechaInicio)}. Revísalo y acéptalo para continuar.</p>
            <TablaCronograma cr={p.nuevoPendiente} />
            <BotonPortal etiqueta="Acepto el nuevo cronograma" accion={acciones.aceptarCronograma} />
          </CardContent>
        </Card>
      )}

      {/* Paso 2: pagar */}
      {aceptada && <BloquePago d={d} qrUrl={qrUrl} datosBancarios={datosBancarios} accionSubir={acciones.subirComprobante} titulo={primeraPagada ? "Pagar tu próxima cuota" : "2. Paga la primera cuota con QR"} />}

      {/* Pasos 3 y 4 (formulario y archivos) */}
      {aceptada && extras?.formulario}
      {aceptada && extras?.archivos}

      {/* Paso 5: avance */}
      {aceptada && cr && (
        <Card>
          <CardHeader>
            <CardTitle>5. Tu avance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Avance del proyecto">
                <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1" data-testid="avance-portal">
                {pct}% completado
              </p>
            </div>
            <p>
              <strong>Este mes{mes >= 1 && mes <= cr.meses ? ` (mes ${mes})` : ""}:</strong> {delMes.length ? delMes.map((a) => a.nombre).join(", ") : mes === 0 ? "el cronograma aún no empieza" : "cronograma completado"}
            </p>
            <p>
              <strong>Próxima cuota:</strong> {proxima ? `${formatoMoneda(proxima.aPagarCentavos, moneda)} · ${formatoFecha(proxima.vencimiento)}` : "ninguna"}
            </p>
            <p>
              <strong>Revisiones del tribunal:</strong> {p.revisiones.map((r) => `${r.numero}.ª ${r.estado}`).join(" · ")}
            </p>
            <TablaCronograma cr={cr} />
          </CardContent>
        </Card>
      )}
      {aceptada && extras?.solicitudes}
      {aceptada && <HistorialPagosPortal d={d} />}
    </div>
  );
}
