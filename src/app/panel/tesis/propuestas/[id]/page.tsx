import Link from "next/link";
import { notFound } from "next/navigation";
import { hoyDe, requerirModulo } from "@/core/contexto";
import { Aviso } from "@/components/ui/aviso";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { withOrg } from "@/lib/db";
import { formatoMoneda } from "@/lib/dinero";
import { formatoFecha, sumarMeses } from "@/lib/fechas";
import { BotonWhatsApp } from "@/modules/cobros/componentes/boton-whatsapp";
import { BadgeMora } from "@/modules/cobros/componentes/estado";
import type { ClavePlantilla } from "@/modules/cobros/dominio/mensajes";
import { urlPortal } from "@/modules/cobros/servicios/enlaces";
import { mensaje, vars } from "@/modules/cobros/servicios/mensajes";
import { BadgeEstadoProyecto } from "@/modules/tesis/componentes/estado";
import { avance, mesActual } from "@/modules/tesis/dominio/cronograma";
import { ESTADOS_ACTIVOS, ESTADOS_EDITABLES } from "@/modules/tesis/dominio/estados";
import { obtenerProyecto, sincronizarProyecto } from "@/modules/tesis/servicios/propuestas";
import { AccionesProyecto, BotonAprobar, BotonRevision, CasillaActividad, EnviarPropuesta, Notas, NuevoCronograma } from "./ficha-cliente";

export default async function FichaProyectoPage(props: { params: Promise<{ id: string }> }) {
  const ctx = await requerirModulo("tesis", "tesis:ver");
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const hoy = hoyDe(ctx);
  const datos = await withOrg(ctx.organizacion.id, async (tx) => {
    await sincronizarProyecto(tx, id, hoy);
    const p = await obtenerProyecto(tx, id);
    if (!p) return null;
    const url = p.enlace?.token ? urlPortal(p.enlace.token) : null;
    let clave: ClavePlantilla | null = null;
    if (p.propuesta.estado === "enviada" && !p.propuesta.aceptadaEn) clave = "propuesta_por_vencer";
    else if (p.nuevoPendiente) clave = "nuevo_cronograma";
    else if (p.propuesta.estado === "en_cola") clave = "en_cola";
    else if (p.propuesta.aceptadaEn) clave = "recordatorio";
    const proxima = p.plan.cuotas.find((c) => c.estado === "pendiente");
    const texto = clave
      ? await mensaje(tx, clave, vars({ nombre: p.cliente.nombre, montoCentavos: proxima?.aPagarCentavos, moneda: p.plan.plan.moneda, fecha: clave === "propuesta_por_vencer" ? (p.propuesta.expiraEn?.toISOString().slice(0, 10) ?? null) : proxima?.fechaVencimiento, enlace: url, proyecto: p.propuesta.titulo }))
      : null;
    return { p, url, texto };
  });
  if (!datos) notFound();
  const { p, url, texto } = datos;
  const pr = p.propuesta;
  const editable = ctx.puede("tesis:editar");
  const cr = p.vigente;
  const pct = cr ? avance(cr.actividades) : 0;
  const mes = cr ? mesActual(cr.fechaInicio, hoy, cr.meses) : 0;
  const activo = ESTADOS_ACTIVOS.includes(pr.estado) || pr.estado === "tribunal";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{pr.titulo}</h1>
          <p className="text-sm text-muted-foreground">
            {p.cliente.nombre} · {pr.universidad ?? "—"} · {pr.nivel}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <BadgeEstadoProyecto estado={pr.estado} />
          {texto && <BotonWhatsApp numero={p.cliente.whatsapp} mensaje={texto} />}
        </div>
      </div>

      {pr.estado === "vencida" && <Aviso tipo="aviso">La propuesta venció sin ser aceptada: el enlace se destruyó. Puedes editarla y reenviarla con un enlace nuevo.</Aviso>}
      {pr.estado === "enviada" && !pr.aceptadaEn && pr.expiraEn && (
        <Aviso tipo="info">
          Enviada {pr.vecesEnviada > 1 ? `(${pr.vecesEnviada} veces)` : ""}. El enlace vence el <strong>{formatoFecha(pr.expiraEn)}</strong>.
        </Aviso>
      )}
      {pr.aceptadaEn && (
        <p className="text-sm" data-testid="aceptada-en">
          Aceptada por el estudiante el <strong>{formatoFecha(pr.aceptadaEn)}</strong>
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Propuesta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={`/api/tesis/propuestas/${pr.id}/pdf`} target="_blank" rel="noopener">
                Ver PDF
              </a>
            </Button>
            {editable && ESTADOS_EDITABLES.includes(pr.estado) && !pr.aceptadaEn && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/panel/tesis/propuestas/${pr.id}/editar`}>Editar</Link>
              </Button>
            )}
            <Button asChild variant="ghost" size="sm">
              <Link href={`/panel/cobros/planes/${pr.planId}`}>Plan de pagos en Cobros</Link>
            </Button>
          </div>
          {url && <code className="block break-all rounded bg-muted p-2 text-xs" data-testid="url-actual">{url}</code>}
          {editable && !pr.aceptadaEn && ESTADOS_EDITABLES.includes(pr.estado) && <EnviarPropuesta id={pr.id} reenvio={pr.vecesEnviada > 0} tieneCi={!!p.cliente.ci} />}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Cuotas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span>
                Total {formatoMoneda(p.plan.total, p.plan.plan.moneda)} · pagado {formatoMoneda(p.plan.pagado, p.plan.plan.moneda)}
              </span>
              <BadgeMora estado={p.plan.plan.estadoMora} />
            </div>
            <ul className="divide-y">
              {p.plan.cuotas.map((c) => (
                <li key={c.id} className="flex justify-between py-1.5">
                  <span>
                    {c.numero}. {c.concepto ?? "Cuota"} · {formatoFecha(c.fechaVencimiento)}
                  </span>
                  <span>
                    {formatoMoneda(c.aPagarCentavos, p.plan.plan.moneda)} {c.estado === "pagada" ? <Badge variant="exito">Pagada</Badge> : c.pagoPendiente ? <Badge variant="info">En revisión</Badge> : null}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Avance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div aria-label={`Avance ${pct}%`}>
              <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1" data-testid="avance">
                {pct}% · {cr ? `mes ${Math.min(mes, cr.meses)} de ${cr.meses}` : "sin cronograma"}
              </p>
            </div>
            {cr && (
              <ul className="space-y-1">
                {cr.actividades.map((a) => (
                  <li key={a.id} className="flex items-start gap-2">
                    {editable && activo ? <CasillaActividad propuestaId={pr.id} id={a.id} nombre={a.nombre} hecha={a.hecha} /> : <span aria-hidden>{a.hecha ? "✔" : "•"}</span>}
                    <span className={a.hecha ? "text-muted-foreground line-through" : ""}>
                      {a.nombre} <span className="text-xs text-muted-foreground">(mes {a.meses.join(", ")}{a.aCargoEstudiante ? " · estudiante" : ""})</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {editable && pr.aceptadaEn && (pr.requiereNuevoCronograma || pr.estado === "en_cola" || p.nuevoPendiente) && cr && (
        <Card>
          <CardHeader>
            <CardTitle>Nuevo cronograma</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {p.nuevoPendiente ? (
              <Aviso tipo="info">Enviaste un cronograma nuevo (versión {p.nuevoPendiente.version}); falta que el estudiante lo acepte en su enlace.</Aviso>
            ) : (
              <p className="text-sm">El proyecto quedó en cola. Cuando el estudiante regularice el pago, arma un cronograma con las fechas corridas: él lo debe aceptar para volver a «en curso».</p>
            )}
            <NuevoCronograma
              propuestaId={pr.id}
              inicial={{
                fechaInicio: sumarMeses(cr.fechaInicio, 1),
                meses: cr.meses,
                actividades: cr.actividades.map((a) => ({ nombre: a.nombre, meses: a.meses, aCargoEstudiante: a.aCargoEstudiante, hecha: a.hecha })),
              }}
            />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revisiones del tribunal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {p.revisiones.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 last:border-0">
                <span>
                  Revisión {r.numero} {r.incluida ? "(incluida)" : `· ${formatoMoneda(r.precioCentavos, p.plan.plan.moneda)}`} · <Badge variant={r.estado === "hecha" ? "exito" : r.estado === "solicitada" ? "aviso" : "secondary"}>{r.estado}</Badge>
                </span>
                {editable && (r.estado === "solicitada" ? <BotonAprobar propuestaId={pr.id} tipo="revision" refId={r.id} /> : pr.aceptadaEn && <BotonRevision propuestaId={pr.id} id={r.id} hecha={r.estado === "hecha"} />)}
              </div>
            ))}
            {!p.revisiones.some((r) => r.numero === 3) && <p className="text-muted-foreground">3.ª revisión (aparte): {formatoMoneda(pr.precioTerceraRevisionCentavos, p.plan.plan.moneda)}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Extras</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {p.extras.length === 0 && <p className="text-muted-foreground">Sin extras.</p>}
            {p.extras.map((x) => (
              <div key={x.id} className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 last:border-0">
                <span>
                  {x.nombre} · {formatoMoneda(x.precioCentavos, p.plan.plan.moneda)} · <Badge variant={x.estado === "solicitado" ? "aviso" : "secondary"}>{x.estado}</Badge>
                </span>
                {editable && x.estado === "solicitado" && <BotonAprobar propuestaId={pr.id} tipo="extra" refId={x.id} />}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {p.archivos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Archivos</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm" data-testid="archivos-proyecto">
              {p.archivos.map((a) => (
                <li key={a.id}>
                  <a className="text-primary underline" href={`/api/archivos/${a.archivoId}`} target="_blank" rel="noopener">
                    {a.nombre}
                  </a>{" "}
                  <span className="text-xs text-muted-foreground">
                    · {(a.tamano / 1024 / 1024).toFixed(2)} MB · {a.descripcion ?? a.origen} · {formatoFecha(a.creadoEn)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {p.respuestas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Formulario respondido</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">Enviado el {formatoFecha(p.respuestas[0].enviadoEn)}. Las respuestas con archivos aparecen en «Archivos».</p>
            <pre className="mt-2 max-h-64 overflow-auto rounded bg-muted p-2 text-xs">{JSON.stringify(p.respuestas[0].valores, null, 2)}</pre>
          </CardContent>
        </Card>
      )}

      {editable && pr.aceptadaEn && (
        <Card>
          <CardHeader>
            <CardTitle>Estado del proyecto</CardTitle>
          </CardHeader>
          <CardContent>
            <AccionesProyecto id={pr.id} />
          </CardContent>
        </Card>
      )}

      {editable && (
        <Card>
          <CardHeader>
            <CardTitle>Notas</CardTitle>
          </CardHeader>
          <CardContent>
            <Notas propuestaId={pr.id} inicial={pr.notas ?? ""} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Historial</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1 text-sm" data-testid="historial-propuesta">
            {p.historial.map((h) => (
              <li key={h.id} className="border-b py-1 last:border-0">
                <span className="text-muted-foreground">{formatoFecha(h.creadoEn)}</span> · <strong>{h.evento}</strong>
                {h.detalle && <span className="text-muted-foreground"> — {h.detalle}</span>}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
