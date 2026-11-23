import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { withOrg } from "@/lib/db";
import { formatoMoneda } from "@/lib/dinero";
import { formatoFecha } from "@/lib/fechas";
import { BotonPortal } from "@/modules/tesis/componentes/boton-portal";
import { FormularioPortal, SubirArchivosPortal } from "@/modules/tesis/componentes/formulario-portal";
import type { ExtrasPortalTesis } from "@/modules/tesis/componentes/portal-tesis";
import { obtenerFormulario } from "@/modules/tesis/servicios/formularios";
import type { Proyecto } from "@/modules/tesis/servicios/propuestas";
import { accionEnviarFormulario, accionSolicitarExtra, accionSolicitarRevision, accionSubirArchivos } from "./acciones-tesis";

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
      <Card>
        <CardHeader>
          <CardTitle>3. {formulario.nombre}</CardTitle>
        </CardHeader>
        <CardContent>
          <FormularioPortal
            campos={formulario.campos.map((c) => ({ id: c.id, tipo: c.tipo, etiqueta: c.etiqueta, ayuda: c.ayuda, obligatorio: c.obligatorio, opciones: c.opciones }))}
            descripcion={formulario.descripcion}
            accion={accionEnviarFormulario.bind(null, token)}
            enviado={p.respuestas.length > 0}
          />
        </CardContent>
      </Card>
    ) : undefined,
    archivos: (
      <Card>
        <CardHeader>
          <CardTitle>4. Tus archivos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {propios.length > 0 && (
            <ul className="space-y-1 text-sm" data-testid="archivos-portal">
              {propios.map((a) => (
                <li key={a.id}>
                  <a className="text-primary underline" href={`/api/archivos/${a.archivoId}`} target="_blank" rel="noopener">
                    {a.nombre}
                  </a>{" "}
                  <span className="text-xs text-muted-foreground">
                    {a.descripcion ? `· ${a.descripcion} ` : ""}· {formatoFecha(a.creadoEn)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <SubirArchivosPortal accion={accionSubirArchivos.bind(null, token)} />
        </CardContent>
      </Card>
    ),
    solicitudes: (
      <Card>
        <CardHeader>
          <CardTitle>Pedir extras</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {tercera ? (
            <p>
              3.ª revisión del tribunal: <strong>{tercera.estado}</strong>
            </p>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>3.ª revisión del tribunal · {formatoMoneda(p.propuesta.precioTerceraRevisionCentavos, moneda)}</span>
              <BotonPortal etiqueta="Pedir 3.ª revisión" variante="outline" accion={accionSolicitarRevision.bind(null, token)} confirmar="¿Pedir la 3.ª revisión? Se agregará una cuota a tu plan cuando la asesora la confirme." />
            </div>
          )}
          {ofrecidos.map((x) => (
            <div key={x.id} className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {x.nombre} · {formatoMoneda(x.precioCentavos, moneda)}
              </span>
              <BotonPortal etiqueta={`Pedir ${x.nombre.toLowerCase()}`} variante="outline" accion={accionSolicitarExtra.bind(null, token, x.id)} />
            </div>
          ))}
          {pedidos.map((x) => (
            <p key={x.id}>
              {x.nombre}: <strong>{x.estado}</strong>
            </p>
          ))}
        </CardContent>
      </Card>
    ),
  };
}
