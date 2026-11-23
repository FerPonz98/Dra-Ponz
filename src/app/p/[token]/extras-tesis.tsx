import { FileText, Sparkles } from "lucide-react";
import { ZonaArchivos } from "@/components/ui/zona-archivos";
import { withOrg } from "@/lib/db";
import { formatoMoneda } from "@/lib/dinero";
import { formatoFecha } from "@/lib/fechas";
import { BotonPortal } from "@/modules/tesis/componentes/boton-portal";
import { FormularioPortal } from "@/modules/tesis/componentes/formulario-portal";
import { TarjetaPortal, type ExtrasPortalTesis } from "@/modules/tesis/componentes/portal-tesis";
import { obtenerFormulario } from "@/modules/tesis/servicios/formularios";
import type { Proyecto } from "@/modules/tesis/servicios/propuestas";
import { accionEnviarFormulario, accionSolicitarExtra, accionSolicitarRevision } from "./acciones-tesis";

/** Pasos 3 y 4 (formulario y archivos) y solicitudes de extras del portal del estudiante. */
export async function extrasPortalTesis(token: string, organizacionId: string, p: Proyecto): Promise<ExtrasPortalTesis> {
  const formulario = p.propuesta.formularioId ? await withOrg(organizacionId, (tx) => obtenerFormulario(tx, p.propuesta.formularioId!)) : null;
  const moneda = p.plan.plan.moneda;
  const propios = p.archivos.filter((a) => a.origen !== "asesora");
  const tercera = p.revisiones.find((r) => r.numero === 3);
  const ofrecidos = p.extras.filter((x) => x.estado === "ofrecido");
  const pedidos = p.extras.filter((x) => x.estado !== "ofrecido");

  return {
    formulario: formulario ? (
      <TarjetaPortal titulo={formulario.nombre} paso={3}>
        <FormularioPortal
          campos={formulario.campos.map((c) => ({ id: c.id, tipo: c.tipo, etiqueta: c.etiqueta, ayuda: c.ayuda, obligatorio: c.obligatorio, opciones: c.opciones }))}
          descripcion={formulario.descripcion}
          accion={accionEnviarFormulario.bind(null, token)}
          enviado={p.respuestas.length > 0}
        />
      </TarjetaPortal>
    ) : undefined,
    archivos: (
      <TarjetaPortal titulo="Tus archivos" paso={4}>
        <div className="space-y-4">
          {propios.length > 0 && (
            <ul className="space-y-2" data-testid="archivos-portal">
              {propios.map((a) => (
                <li key={a.id} className="flex items-center gap-3 rounded-2xl border border-border p-3">
                  <FileText className="size-5 shrink-0 text-primary" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <a className="block truncate text-sm font-medium text-primary hover:underline" href={`/api/archivos/${a.archivoId}`} target="_blank" rel="noopener">
                      {a.nombre}
                    </a>
                    <span className="text-xs text-muted-foreground">
                      {a.descripcion ? `${a.descripcion} · ` : ""}
                      {formatoFecha(a.creadoEn)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <ZonaArchivos
            url={`/p/${token}/archivos`}
            campo="archivos"
            multiple
            conDescripcion
            etiqueta="Archivos (PDF, Word, Excel o ZIP; máx. 50 MB c/u)"
            ayuda="Para otros formatos (fotos, audios, SPSS…), comprímelos en un ZIP."
            accept=".pdf,.doc,.docx,.xls,.xlsx,.zip"
            textoBoton="Subir archivos"
            mensajeExito="Archivos subidos."
          />
        </div>
      </TarjetaPortal>
    ),
    solicitudes: (
      <TarjetaPortal titulo="¿Necesitas algo más?">
        <ul className="space-y-3 text-sm">
          <li className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface-2 p-4">
            {tercera ? (
              <span>
                3.ª revisión del tribunal: <strong>{tercera.estado}</strong>
              </span>
            ) : (
              <>
                <span>
                  <span className="block font-medium">3.ª revisión del tribunal</span>
                  <span className="text-muted-foreground">{formatoMoneda(p.propuesta.precioTerceraRevisionCentavos, moneda)}</span>
                </span>
                <BotonPortal
                  etiqueta="Pedir 3.ª revisión"
                  variante="outline"
                  accion={accionSolicitarRevision.bind(null, token)}
                  confirmar="¿Pedir la 3.ª revisión?"
                  descripcion="Se agregará una cuota a tu plan cuando la asesora la confirme."
                  textoConfirmar="Sí, pedirla"
                />
              </>
            )}
          </li>
          {ofrecidos.map((x) => (
            <li key={x.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface-2 p-4">
              <span>
                <span className="flex items-center gap-1.5 font-medium">
                  <Sparkles className="size-4 text-aviso" aria-hidden />
                  {x.nombre}
                </span>
                <span className="text-muted-foreground">{formatoMoneda(x.precioCentavos, moneda)}</span>
              </span>
              <BotonPortal etiqueta={`Pedir ${x.nombre.toLowerCase()}`} variante="outline" accion={accionSolicitarExtra.bind(null, token, x.id)} />
            </li>
          ))}
          {pedidos.map((x) => (
            <li key={x.id} className="rounded-2xl bg-surface-2 p-4">
              {x.nombre}: <strong>{x.estado}</strong>
            </li>
          ))}
        </ul>
      </TarjetaPortal>
    ),
  };
}
