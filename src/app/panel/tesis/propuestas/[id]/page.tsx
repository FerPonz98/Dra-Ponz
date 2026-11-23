import { CalendarRange, ClipboardList, FileDown, FolderOpen, History, LayoutDashboard, Pencil, Wallet } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { hoyDe, requerirModulo } from "@/core/contexto";
import { Aviso } from "@/components/ui/aviso";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineaTiempo } from "@/components/ui/linea-tiempo";
import { ListaPestanas, PanelPestana, Pestana, Pestanas } from "@/components/ui/tabs";
import { AnilloProgreso, Avatar, EstadoVacio, Migas } from "@/components/ui/varios";
import { withOrg } from "@/lib/db";
import { formatoMoneda } from "@/lib/dinero";
import { formatoFecha, sumarMeses } from "@/lib/fechas";
import { cn } from "@/lib/utils";
import { BotonWhatsApp } from "@/modules/cobros/componentes/boton-whatsapp";
import { BadgeMora } from "@/modules/cobros/componentes/estado";
import type { ClavePlantilla } from "@/modules/cobros/dominio/mensajes";
import { urlPortal } from "@/modules/cobros/servicios/enlaces";
import { mensaje, vars } from "@/modules/cobros/servicios/mensajes";
import { BadgeEstadoProyecto } from "@/modules/tesis/componentes/estado";
import { avance, mesActual, rangoMes } from "@/modules/tesis/dominio/cronograma";
import { ESTADOS_ACTIVOS, ESTADOS_EDITABLES } from "@/modules/tesis/dominio/estados";
import { obtenerProyecto, sincronizarProyecto } from "@/modules/tesis/servicios/propuestas";
import { AccionesProyecto, BotonAprobar, BotonRevision, CasillaActividad, EnviarPropuesta, Notas, NuevoCronograma } from "./ficha-cliente";

const PESTANAS = ["resumen", "cuotas", "cronograma", "archivos", "historial"] as const;

export default async function FichaProyectoPage(props: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const ctx = await requerirModulo("tesis", "tesis:ver");
  const { id } = await props.params;
  const { tab } = await props.searchParams;
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
  const moneda = p.plan.plan.moneda;
  const pestana = PESTANAS.includes(tab as (typeof PESTANAS)[number]) ? tab! : "resumen";
  const puedeEnviar = editable && !pr.aceptadaEn && ESTADOS_EDITABLES.includes(pr.estado);
  const meses = cr ? Array.from({ length: cr.meses }, (_, i) => i + 1) : [];

  return (
    <div className="space-y-6">
      <Migas items={[{ etiqueta: "Propuestas y proyectos", href: "/panel/tesis/propuestas" }, { etiqueta: pr.titulo }]} />

      <div className="flex flex-col gap-5 rounded-xl border border-border bg-surface p-5 shadow-xs md:flex-row md:items-center">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <BadgeEstadoProyecto estado={pr.estado} />
            <Badge variant="outline" punto={false} className="capitalize">
              {pr.nivel}
            </Badge>
            {pr.aceptadaEn && <BadgeMora estado={p.plan.plan.estadoMora} />}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-balance">{pr.titulo}</h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <Avatar nombre={p.cliente.nombre} className="size-6 text-[10px]" />
              <Link href={`/panel/cobros/clientes/${p.cliente.id}`} className="font-medium text-foreground hover:text-primary">
                {p.cliente.nombre}
              </Link>
            </span>
            {pr.universidad && <span>{pr.universidad}</span>}
            <span>Total {formatoMoneda(p.plan.total, moneda)}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 md:border-l md:border-border md:pl-5">
          <div className="flex items-center gap-3" data-testid="avance">
            <AnilloProgreso valor={pct} etiqueta={`Avance del proyecto ${pct}%`} />
            <div className="text-sm">
              <p className="font-medium">Avance</p>
              <p className="text-muted-foreground">{cr ? `mes ${Math.max(1, Math.min(mes, cr.meses))} de ${cr.meses}` : "sin cronograma"}</p>
            </div>
          </div>
          {texto && <BotonWhatsApp numero={p.cliente.whatsapp} mensaje={texto} />}
        </div>
      </div>

      {pr.estado === "vencida" && (
        <Aviso tipo="aviso" titulo="La propuesta venció sin ser aceptada">
          El enlace se destruyó. Puedes editarla y reenviarla con un enlace nuevo.
        </Aviso>
      )}
      {pr.estado === "enviada" && !pr.aceptadaEn && pr.expiraEn && (
        <Aviso tipo="info" titulo={`Enviada${pr.vecesEnviada > 1 ? ` (${pr.vecesEnviada} veces)` : ""}`}>
          El enlace vence el <strong>{formatoFecha(pr.expiraEn)}</strong>.
        </Aviso>
      )}
      {pr.aceptadaEn && (
        <p className="text-sm text-muted-foreground" data-testid="aceptada-en">
          Aceptada por el estudiante el <strong className="text-foreground">{formatoFecha(pr.aceptadaEn)}</strong>
        </p>
      )}

      <Pestanas defaultValue={pestana}>
        <ListaPestanas aria-label="Secciones del proyecto">
          <Pestana value="resumen">
            <LayoutDashboard aria-hidden /> Resumen
          </Pestana>
          <Pestana value="cuotas">
            <Wallet aria-hidden /> Cuotas
          </Pestana>
          <Pestana value="cronograma">
            <CalendarRange aria-hidden /> Cronograma
          </Pestana>
          <Pestana value="archivos">
            <FolderOpen aria-hidden /> Archivos{p.archivos.length ? ` (${p.archivos.length})` : ""}
          </Pestana>
          <Pestana value="historial">
            <History aria-hidden /> Historial
          </Pestana>
        </ListaPestanas>

        <PanelPestana value="resumen" className="space-y-6">
          <Card>
            <CardHeader
              acciones={
                <>
                  <Button asChild variant="outline" size="sm">
                    <a href={`/api/tesis/propuestas/${pr.id}/pdf`} target="_blank" rel="noopener">
                      <FileDown /> Ver PDF
                    </a>
                  </Button>
                  {puedeEnviar && (
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/panel/tesis/propuestas/${pr.id}/editar`}>
                        <Pencil /> Editar
                      </Link>
                    </Button>
                  )}
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/panel/cobros/planes/${pr.planId}`}>Plan de pagos en Cobros</Link>
                  </Button>
                </>
              }
            >
              <CardTitle>Propuesta y enlace</CardTitle>
              <CardDescription>
                Vigencia de {pr.vigenciaDias} días{pr.vecesEnviada ? ` · enviada ${pr.vecesEnviada} ${pr.vecesEnviada === 1 ? "vez" : "veces"}` : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {url && (
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Enlace activo</p>
                  <code className="block break-all rounded-lg border border-border bg-surface-2 p-2.5 font-mono text-xs" data-testid="url-actual">
                    {url}
                  </code>
                </div>
              )}
              {puedeEnviar && <EnviarPropuesta id={pr.id} reenvio={pr.vecesEnviada > 0} tieneCi={!!p.cliente.ci} />}
              {!url && !puedeEnviar && <p className="text-sm text-muted-foreground">No hay un enlace activo.</p>}
            </CardContent>
          </Card>

          {editable && pr.aceptadaEn && (pr.requiereNuevoCronograma || pr.estado === "en_cola" || p.nuevoPendiente) && cr && (
            <Card className="border-aviso/40">
              <CardHeader>
                <CardTitle>Nuevo cronograma</CardTitle>
                <CardDescription>
                  {p.nuevoPendiente
                    ? `Enviaste la versión ${p.nuevoPendiente.version}; falta que el estudiante la acepte en su enlace.`
                    : "El proyecto quedó en cola. Cuando el estudiante regularice el pago, arma un cronograma con las fechas corridas; él lo debe aceptar para volver a «en curso»."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <NuevoCronograma
                  propuestaId={pr.id}
                  inicial={{ fechaInicio: sumarMeses(cr.fechaInicio, 1), meses: cr.meses, actividades: cr.actividades.map((a) => ({ nombre: a.nombre, meses: a.meses, aCargoEstudiante: a.aCargoEstudiante, hecha: a.hecha })) }}
                />
              </CardContent>
            </Card>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Revisiones del tribunal</CardTitle>
                <CardDescription>2 incluidas · la 3.ª cuesta {formatoMoneda(pr.precioTerceraRevisionCentavos, moneda)}</CardDescription>
              </CardHeader>
              <ul className="divide-y divide-border border-t border-border">
                {p.revisiones.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">Revisión {r.numero}</span>
                      <span className="text-muted-foreground">{r.incluida ? "incluida" : formatoMoneda(r.precioCentavos, moneda)}</span>
                      <Badge variant={r.estado === "hecha" ? "exito" : r.estado === "solicitada" ? "aviso" : r.estado === "aprobada" ? "info" : "secondary"}>{r.estado}</Badge>
                    </span>
                    {editable && (r.estado === "solicitada" ? <BotonAprobar propuestaId={pr.id} tipo="revision" refId={r.id} /> : pr.aceptadaEn && <BotonRevision propuestaId={pr.id} id={r.id} hecha={r.estado === "hecha"} />)}
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Extras</CardTitle>
                <CardDescription>Servicios opcionales que el estudiante puede pedir.</CardDescription>
              </CardHeader>
              {p.extras.length === 0 ? (
                <p className="border-t border-border px-5 py-4 text-sm text-muted-foreground">Sin extras en esta propuesta.</p>
              ) : (
                <ul className="divide-y divide-border border-t border-border">
                  {p.extras.map((x) => (
                    <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{x.nombre}</span>
                        <span className="text-muted-foreground">{formatoMoneda(x.precioCentavos, moneda)}</span>
                        <Badge variant={x.estado === "solicitado" ? "aviso" : x.estado === "aprobado" ? "info" : "secondary"}>{x.estado}</Badge>
                      </span>
                      {editable && x.estado === "solicitado" && <BotonAprobar propuestaId={pr.id} tipo="extra" refId={x.id} />}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {editable && pr.aceptadaEn && (
              <Card>
                <CardHeader>
                  <CardTitle>Estado del proyecto</CardTitle>
                  <CardDescription>«Tribunal» y «Finalizado» se marcan a mano.</CardDescription>
                </CardHeader>
                <CardContent>
                  <AccionesProyecto id={pr.id} estado={pr.estado} />
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
          </div>
        </PanelPestana>

        <PanelPestana value="cuotas">
          <Card>
            <CardHeader
              acciones={
                <Button asChild variant="outline" size="sm">
                  <Link href={`/panel/cobros/planes/${pr.planId}`}>Abrir en Cobros</Link>
                </Button>
              }
            >
              <CardTitle>Plan de pagos</CardTitle>
              <CardDescription>
                Total {formatoMoneda(p.plan.total, moneda)} · pagado {formatoMoneda(p.plan.pagado, moneda)}
              </CardDescription>
            </CardHeader>
            <ul className="divide-y divide-border border-t border-border">
              {p.plan.cuotas.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <span className="min-w-0">
                    <span className="font-medium">
                      {c.numero}. {c.concepto ?? "Cuota"}
                    </span>
                    <span className="block text-xs text-muted-foreground">Vence {formatoFecha(c.fechaVencimiento)}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="font-medium tabular-nums">{formatoMoneda(c.aPagarCentavos, moneda)}</span>
                    {c.estado === "pagada" ? <Badge variant="exito">Pagada</Badge> : c.pagoPendiente ? <Badge variant="info">En revisión</Badge> : <Badge variant="secondary">Pendiente</Badge>}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </PanelPestana>

        <PanelPestana value="cronograma">
          {cr ? (
            <Card>
              <CardHeader>
                <CardTitle>Cronograma (versión {cr.version})</CardTitle>
                <CardDescription>
                  Desde {formatoFecha(cr.fechaInicio)} · {cr.meses} meses · {cr.actividades.filter((a) => a.hecha).length} de {cr.actividades.length} actividades hechas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative overflow-x-auto" tabIndex={0} role="region" aria-label="Cronograma de actividades por mes">
                  <table className="w-full min-w-[36rem] border-separate border-spacing-0 text-sm">
                    <thead>
                      <tr>
                        <th className="border-b border-border py-2 pr-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Actividad</th>
                        {meses.map((m) => (
                          <th key={m} className={cn("w-12 border-b border-border py-2 text-center text-xs font-medium text-muted-foreground", m === mes && "text-primary")} title={`${formatoFecha(rangoMes(cr.fechaInicio, m).desde)} – ${formatoFecha(rangoMes(cr.fechaInicio, m).hasta)}`}>
                            M{m}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {cr.actividades.map((a) => (
                        <tr key={a.id}>
                          <td className="border-b border-border py-2.5 pr-3">
                            <span className="flex items-start gap-2.5">
                              {editable && activo ? <CasillaActividad propuestaId={pr.id} id={a.id} nombre={a.nombre} hecha={a.hecha} /> : <span aria-hidden className={cn("mt-1.5 size-2 shrink-0 rounded-full", a.hecha ? "bg-exito" : "bg-border-strong")} />}
                              <span className={a.hecha ? "text-muted-foreground line-through" : ""}>
                                {a.nombre}
                                {a.aCargoEstudiante && <span className="ml-1.5 text-xs text-muted-foreground">(estudiante)</span>}
                              </span>
                            </span>
                          </td>
                          {meses.map((m) => (
                            <td key={m} className={cn("border-b border-border py-2.5 text-center", m === mes && "bg-primary-soft/50")}>
                              {a.meses.includes(m) && (
                                <>
                                  <span aria-hidden className={cn("mx-auto block h-2.5 w-8 rounded-full", a.hecha ? "bg-exito/70" : "bg-primary/70")} />
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
              </CardContent>
            </Card>
          ) : (
            <Card>
              <EstadoVacio icono={CalendarRange} titulo="Sin cronograma" descripcion="Edita la propuesta para cargar la plantilla de actividades." />
            </Card>
          )}
        </PanelPestana>

        <PanelPestana value="archivos" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Archivos del proyecto</CardTitle>
              <CardDescription>Lo que subió el estudiante desde su portal.</CardDescription>
            </CardHeader>
            {p.archivos.length === 0 ? (
              <EstadoVacio icono={FolderOpen} titulo="Aún no hay archivos" descripcion="Cuando el estudiante suba documentos o ZIP, aparecerán aquí." className="py-8" />
            ) : (
              <ul className="divide-y divide-border border-t border-border" data-testid="archivos-proyecto">
                {p.archivos.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-[10px] font-bold uppercase text-primary">{a.nombre.split(".").pop()?.slice(0, 4)}</span>
                    <span className="min-w-0 flex-1">
                      <a className="block truncate font-medium text-primary hover:underline" href={`/api/archivos/${a.archivoId}`} target="_blank" rel="noopener">
                        {a.nombre}
                      </a>
                      <span className="text-xs text-muted-foreground">
                        {a.descripcion ?? a.origen} · {(a.tamano / 1024 / 1024).toFixed(2)} MB · {formatoFecha(a.creadoEn)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {p.respuestas.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Formulario respondido</CardTitle>
                <CardDescription>Enviado el {formatoFecha(p.respuestas[0].enviadoEn)}</CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-3 sm:grid-cols-2">
                  {Object.entries(p.respuestas[0].valores).map(([k, v]) => (
                    <div key={k} className="rounded-lg bg-surface-2 p-3">
                      <dt className="text-xs font-medium text-muted-foreground">{k}</dt>
                      <dd className="mt-0.5 text-sm">
                        {v && typeof v === "object" && "archivoId" in v ? (
                          <a className="font-medium text-primary hover:underline" href={`/api/archivos/${String((v as unknown as { archivoId: string }).archivoId)}`} target="_blank" rel="noopener">
                            <ClipboardList className="mr-1 inline size-3.5" aria-hidden />
                            {String((v as unknown as { nombre: string }).nombre)}
                          </a>
                        ) : (
                          String(v ?? "") || "—"
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          )}
        </PanelPestana>

        <PanelPestana value="historial">
          <Card>
            <CardHeader>
              <CardTitle>Historial</CardTitle>
              <CardDescription>Todo lo que pasó con esta propuesta, del más reciente al más antiguo.</CardDescription>
            </CardHeader>
            <CardContent>
              <LineaTiempo
                testid="historial-propuesta"
                eventos={p.historial.map((h) => ({
                  id: h.id,
                  fecha: formatoFecha(h.creadoEn),
                  autor: h.usuarioNombre,
                  titulo: h.evento,
                  detalle: h.detalle,
                  tono: /acept/i.test(h.evento) ? "exito" : /vencid|cola/i.test(h.evento) ? "peligro" : /envi/i.test(h.evento) ? "primario" : "normal",
                }))}
              />
            </CardContent>
          </Card>
        </PanelPestana>
      </Pestanas>
    </div>
  );
}
