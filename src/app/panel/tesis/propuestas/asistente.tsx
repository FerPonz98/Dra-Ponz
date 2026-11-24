"use client";
import { ArrowLeft, ArrowRight, Check, Plus, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Campo, Input, Select } from "@/components/ui/input";
import { notificar } from "@/components/ui/toaster";
import { aCentavos, formatoMoneda } from "@/lib/dinero";
import { formatoFecha } from "@/lib/fechas";
import { cn } from "@/lib/utils";
import { EditorCuotas, type FilaCuota } from "@/modules/cobros/componentes/editor-cuotas";
import { EditorReglas } from "@/modules/cobros/componentes/editor-reglas";
import type { ReglasMora } from "@/modules/cobros/dominio/plan";
import { EditorCronograma, type ValorCronograma } from "@/modules/tesis/componentes/editor-cronograma";
import { accionGuardarPropuesta } from "../acciones";

export type ValorAsistente = {
  modoEstudiante: "existente" | "nuevo";
  clienteId: string;
  nuevo: { nombre: string; ci: string; whatsapp: string; correo: string };
  titulo: string;
  universidad: string;
  nivel: "pregrado" | "posgrado";
  moneda: "BOB" | "BRL";
  cuotas: FilaCuota[];
  cronograma: ValorCronograma;
  reglas: ReglasMora;
  precioTercera: string;
  extras: { nombre: string; precio: string }[];
  formularioId: string;
  vigenciaDias: number;
};

const PASOS: { titulo: string; descripcion: string }[] = [
  { titulo: "Datos", descripcion: "Tema del proyecto, estudiante y nivel." },
  { titulo: "Moneda", descripcion: "En qué moneda se expresa la propuesta." },
  { titulo: "Plan de pagos", descripcion: "Cuotas y fechas. Se crea el plan en Cobros." },
  { titulo: "Cronograma", descripcion: "Actividades por mes. Puedes cargar la plantilla." },
  { titulo: "Mora", descripcion: "Gracia, recargos y plazo de la primera cuota." },
  { titulo: "Revisiones", descripcion: "2 revisiones incluidas; la 3.ª se cobra aparte." },
  { titulo: "Extras", descripcion: "Servicios opcionales con precio." },
  { titulo: "Formulario", descripcion: "Datos que el estudiante completará en su portal." },
  { titulo: "Vigencia", descripcion: "Días para aceptar antes de que el enlace se destruya." },
  { titulo: "Vista previa", descripcion: "Revisa todo antes de guardar." },
];

type Props = { inicial: ValorAsistente; id?: string; estudiantes: { id: string; nombre: string }[]; formularios: { id: string; nombre: string }[]; hoy: string };

function erroresDePaso(v: ValorAsistente, paso: number): Record<string, string> {
  const e: Record<string, string> = {};
  if (paso === 0) {
    if (v.titulo.trim().length < 3) e.titulo = "Escribe el tema o nombre del proyecto.";
    if (v.modoEstudiante === "existente" && !v.clienteId) e.estudiante = "Elige un estudiante.";
    if (v.modoEstudiante === "nuevo" && v.nuevo.nombre.trim().length < 2) e.estudiante = "Escribe el nombre del estudiante.";
    // Regex acotada (sin cuantificadores que se solapen: no hay ReDoS con entradas largas).
    if (v.nuevo.correo && (v.nuevo.correo.length > 254 || !/^[^\s@]{1,64}@[^\s@.]{1,63}(\.[^\s@.]{1,63})+$/.test(v.nuevo.correo))) e.correo = "Correo inválido.";
  }
  if (paso === 2) {
    if (!v.cuotas.length) e.cuotas = "Genera o agrega al menos una cuota.";
    else if (v.cuotas.some((c) => !c.montoCentavos || c.montoCentavos <= 0)) e.cuotas = "Todas las cuotas necesitan un monto mayor a 0.";
  }
  if (paso === 3) {
    if (!v.cronograma.actividades.length) e.cronograma = "Agrega actividades o carga la plantilla.";
    else if (v.cronograma.actividades.some((a) => a.nombre.trim().length < 2 || !a.meses.length)) e.cronograma = "Cada actividad necesita un nombre y al menos un mes.";
  }
  if (paso === 8 && (!Number.isFinite(v.vigenciaDias) || v.vigenciaDias < 1 || v.vigenciaDias > 90)) e.vigencia = "La vigencia debe estar entre 1 y 90 días.";
  return e;
}

export function AsistentePropuesta({ inicial, id, estudiantes, formularios, hoy }: Props) {
  const router = useRouter();
  const [v, setV] = useState<ValorAsistente>(inicial);
  const [paso, setPaso] = useState(0);
  const [visitados, setVisitados] = useState<Set<number>>(new Set(id ? PASOS.map((_, i) => i) : [0]));
  const [mostrarErrores, setMostrarErrores] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const set = (c: Partial<ValorAsistente>) => setV((x) => ({ ...x, ...c }));
  const total = v.cuotas.reduce((s, c) => s + (c.montoCentavos || 0), 0);
  const err = mostrarErrores ? erroresDePaso(v, paso) : {};
  const ultimo = paso === PASOS.length - 1;
  const nombreEstudiante = v.modoEstudiante === "nuevo" ? v.nuevo.nombre : estudiantes.find((e) => e.id === v.clienteId)?.nombre;

  function ir(n: number) {
    setPaso(n);
    setMostrarErrores(false);
    setVisitados((s) => new Set(s).add(n));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function siguiente() {
    if (Object.keys(erroresDePaso(v, paso)).length) return setMostrarErrores(true);
    ir(paso + 1);
  }

  async function guardar() {
    const conError = PASOS.findIndex((_, i) => Object.keys(erroresDePaso(v, i)).length > 0);
    if (conError !== -1) {
      ir(conError);
      setMostrarErrores(true);
      notificar({ ok: false, mensaje: `Revisa el paso ${conError + 1}: ${PASOS[conError].titulo}.` });
      return;
    }
    setGuardando(true);
    const r = await accionGuardarPropuesta(
      {
        estudiante: v.modoEstudiante === "existente" ? { clienteId: v.clienteId } : { nuevo: v.nuevo },
        titulo: v.titulo,
        universidad: v.universidad,
        nivel: v.nivel,
        moneda: v.moneda,
        cuotas: v.cuotas.map((c) => ({ id: c.id, concepto: c.concepto ?? null, montoCentavos: c.montoCentavos, fechaVencimiento: c.fechaVencimiento })),
        cronograma: { fechaInicio: v.cronograma.fechaInicio, meses: v.cronograma.meses, actividades: v.cronograma.actividades.map((a) => ({ nombre: a.nombre, meses: a.meses, aCargoEstudiante: a.aCargoEstudiante, hecha: a.hecha })) },
        reglas: v.reglas,
        precioTerceraRevisionCentavos: aCentavos(v.precioTercera || "0") ?? 0,
        extras: v.extras.filter((e) => e.nombre.trim()).map((e) => ({ nombre: e.nombre, precioCentavos: aCentavos(e.precio || "0") ?? 0 })),
        formularioId: v.formularioId || null,
        vigenciaDias: Number(v.vigenciaDias),
      },
      id,
    );
    setGuardando(false);
    if (r.ok && r.datos) {
      notificar({ ok: true, mensaje: id ? "Cambios guardados." : "Propuesta guardada como borrador." });
      router.push(`/panel/tesis/propuestas/${r.datos.id}`);
      router.refresh();
    } else if (!r.ok) notificar(r);
  }

  const progreso = Math.round(((paso + 1) / PASOS.length) * 100);

  return (
    <div className="space-y-6">
      {/* Stepper */}
      <div className="rounded-xl border border-border bg-surface p-4 shadow-xs">
        <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Paso <strong className="text-foreground">{paso + 1}</strong> de {PASOS.length}
          </span>
          <span className="tabular-nums">{progreso}%</span>
        </div>
        <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${progreso}%` }} />
        </div>
        <nav aria-label="Pasos">
          <ol className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
            {PASOS.map((p, i) => {
              const conError = visitados.has(i) && i !== paso && Object.keys(erroresDePaso(v, i)).length > 0;
              const completo = visitados.has(i) && i < paso && !conError;
              return (
                <li key={p.titulo} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => ir(i)}
                    aria-current={paso === i ? "step" : undefined}
                    className={cn(
                      "flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                      paso === i ? "border-primary bg-primary text-primary-foreground" : conError ? "border-peligro/40 bg-peligro-soft text-peligro" : completo ? "border-exito/30 bg-exito-soft text-exito" : "border-border bg-surface text-muted-foreground hover:bg-muted",
                    )}
                  >
                    <span className={cn("flex size-4 items-center justify-center rounded-full text-[10px]", paso === i ? "bg-primary-foreground/20" : "")} aria-hidden>
                      {completo ? <Check className="size-3" /> : i + 1}
                    </span>
                    <span className="sr-only">{i + 1}. </span>
                    {p.titulo}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {paso + 1}. {PASOS[paso].titulo}
            </CardTitle>
            <CardDescription>{PASOS[paso].descripcion}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {paso === 0 && (
              <div className="grid gap-4 md:grid-cols-2">
                <Campo etiqueta="Nombre del proyecto o tema" htmlFor="a-titulo" error={err.titulo} className="md:col-span-2">
                  <Input id="a-titulo" value={v.titulo} onChange={(e) => set({ titulo: e.target.value })} aria-invalid={!!err.titulo} placeholder="Ej. Factores asociados a la deserción universitaria en Pando" />
                </Campo>
                <fieldset className="space-y-3 md:col-span-2">
                  <legend className="text-sm font-medium">Estudiante</legend>
                  <div className="inline-flex rounded-lg border border-border bg-surface-2 p-1 text-sm">
                    {(["nuevo", "existente"] as const).map((m) => (
                      <label key={m} className={cn("cursor-pointer rounded-md px-3 py-1.5 font-medium has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring", v.modoEstudiante === m ? "bg-surface text-foreground shadow-xs" : "text-muted-foreground")}>
                        <input type="radio" name="modo" className="sr-only" checked={v.modoEstudiante === m} onChange={() => set({ modoEstudiante: m })} />
                        {m === "nuevo" ? "Nuevo" : "Existente"}
                      </label>
                    ))}
                  </div>
                  {v.modoEstudiante === "existente" ? (
                    <Campo etiqueta="Elige al estudiante" htmlFor="a-est" error={err.estudiante}>
                      <Select id="a-est" aria-label="Estudiante" value={v.clienteId} onChange={(e) => set({ clienteId: e.target.value })} aria-invalid={!!err.estudiante}>
                        <option value="">Elige…</option>
                        {estudiantes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nombre}
                          </option>
                        ))}
                      </Select>
                    </Campo>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Campo etiqueta="Nombre del estudiante" htmlFor="a-est-nombre" error={err.estudiante}>
                        <Input id="a-est-nombre" value={v.nuevo.nombre} onChange={(e) => set({ nuevo: { ...v.nuevo, nombre: e.target.value } })} aria-invalid={!!err.estudiante} />
                      </Campo>
                      <Campo etiqueta="CI del estudiante" htmlFor="a-est-ci" ayuda="Lo usará para entrar a su portal.">
                        <Input id="a-est-ci" value={v.nuevo.ci} onChange={(e) => set({ nuevo: { ...v.nuevo, ci: e.target.value } })} />
                      </Campo>
                      <Campo etiqueta="WhatsApp del estudiante" htmlFor="a-est-wa" ayuda="Con código de país, ej. 59171234567">
                        <Input id="a-est-wa" inputMode="tel" value={v.nuevo.whatsapp} onChange={(e) => set({ nuevo: { ...v.nuevo, whatsapp: e.target.value } })} />
                      </Campo>
                      <Campo etiqueta="Correo del estudiante" htmlFor="a-est-correo" error={err.correo}>
                        <Input id="a-est-correo" type="email" value={v.nuevo.correo} onChange={(e) => set({ nuevo: { ...v.nuevo, correo: e.target.value } })} />
                      </Campo>
                    </div>
                  )}
                </fieldset>
                <Campo etiqueta="Universidad" htmlFor="a-uni">
                  <Input id="a-uni" value={v.universidad} onChange={(e) => set({ universidad: e.target.value })} />
                </Campo>
                <Campo etiqueta="Nivel" htmlFor="a-nivel">
                  <Select id="a-nivel" value={v.nivel} onChange={(e) => set({ nivel: e.target.value as ValorAsistente["nivel"] })}>
                    <option value="pregrado">Pregrado</option>
                    <option value="posgrado">Posgrado</option>
                  </Select>
                </Campo>
              </div>
            )}
            {paso === 1 && (
              <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Moneda de la propuesta">
                {(
                  [
                    ["BOB", "Bolivianos", "El estudiante paga en Bs."],
                    ["BRL", "Reales", "Se cobra en Bs al tipo de cambio oficial del día del pago."],
                  ] as const
                ).map(([m, t, d]) => (
                  <label key={m} className={cn("cursor-pointer rounded-xl border p-4 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring", v.moneda === m ? "border-primary bg-primary-soft ring-1 ring-primary" : "border-border hover:bg-surface-2")}>
                    <input type="radio" name="moneda" className="sr-only" checked={v.moneda === m} onChange={() => set({ moneda: m })} />
                    <span className="block text-sm font-semibold">
                      {t} ({m})
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">{d}</span>
                  </label>
                ))}
              </div>
            )}
            {paso === 2 && (
              <>
                <EditorCuotas value={v.cuotas} onChange={(cuotas) => set({ cuotas })} moneda={v.moneda} hoy={hoy} />
                {err.cuotas && <p className="text-xs font-medium text-peligro" role="alert">{err.cuotas}</p>}
              </>
            )}
            {paso === 3 && (
              <>
                <EditorCronograma value={v.cronograma} onChange={(cronograma) => set({ cronograma })} />
                {err.cronograma && <p className="text-xs font-medium text-peligro" role="alert">{err.cronograma}</p>}
              </>
            )}
            {paso === 4 && <EditorReglas value={v.reglas} onChange={(reglas) => set({ reglas })} />}
            {paso === 5 && (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  {["1.ª revisión", "2.ª revisión"].map((t) => (
                    <div key={t} className="rounded-xl border border-exito/30 bg-exito-soft p-4">
                      <p className="text-sm font-semibold">{t}</p>
                      <p className="text-xs text-exito">Incluida</p>
                    </div>
                  ))}
                  <div className="rounded-xl border border-border p-4">
                    <p className="text-sm font-semibold">3.ª revisión</p>
                    <p className="text-xs text-muted-foreground">Se cobra aparte si la pide</p>
                  </div>
                </div>
                <Campo etiqueta={`Precio de la 3.ª revisión (${v.moneda})`} htmlFor="a-rev3" className="max-w-xs">
                  <Input id="a-rev3" inputMode="decimal" value={v.precioTercera} onChange={(e) => set({ precioTercera: e.target.value })} placeholder="0.00" />
                </Campo>
              </div>
            )}
            {paso === 6 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">La defensa no es un extra: la realiza el estudiante.</p>
                {v.extras.map((x, i) => (
                  <div key={i} className="grid grid-cols-[1fr_8rem_auto] items-end gap-2">
                    <Campo etiqueta="Extra" htmlFor={`a-x-${i}`}>
                      <Input id={`a-x-${i}`} value={x.nombre} onChange={(e) => set({ extras: v.extras.map((y, j) => (j === i ? { ...y, nombre: e.target.value } : y)) })} />
                    </Campo>
                    <Campo etiqueta="Precio" htmlFor={`a-xp-${i}`}>
                      <Input id={`a-xp-${i}`} inputMode="decimal" value={x.precio} onChange={(e) => set({ extras: v.extras.map((y, j) => (j === i ? { ...y, precio: e.target.value } : y)) })} />
                    </Campo>
                    <Button type="button" variant="ghost" size="icon" aria-label={`Quitar extra ${i + 1}`} onClick={() => set({ extras: v.extras.filter((_, j) => j !== i) })}>
                      <Trash2 />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => set({ extras: [...v.extras, { nombre: "", precio: "" }] })}>
                  <Plus /> Agregar extra
                </Button>
              </div>
            )}
            {paso === 7 && (
              <Campo etiqueta="Formulario de recolección de datos" htmlFor="a-form" ayuda={formularios.length ? "El estudiante lo completará después de aceptar." : "Aún no creaste formularios (menú Formularios)."}>
                <Select id="a-form" value={v.formularioId} onChange={(e) => set({ formularioId: e.target.value })}>
                  <option value="">Sin formulario</option>
                  {formularios.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nombre}
                    </option>
                  ))}
                </Select>
              </Campo>
            )}
            {paso === 8 && (
              <Campo etiqueta="Vigencia del enlace (días)" htmlFor="a-vig" error={err.vigencia} ayuda="Si no acepta en este plazo, el enlace se destruye y la propuesta queda vencida (podrás editarla y reenviarla)." className="max-w-sm">
                <Input id="a-vig" type="number" min={1} max={90} value={v.vigenciaDias} onChange={(e) => set({ vigenciaDias: Number(e.target.value) })} aria-invalid={!!err.vigencia} />
              </Campo>
            )}
            {paso === 9 && (
              <dl className="grid gap-4 sm:grid-cols-2">
                {[
                  ["Proyecto", v.titulo || "—"],
                  ["Estudiante", nombreEstudiante || "—"],
                  ["Universidad y nivel", `${v.universidad || "—"} · ${v.nivel}`],
                  ["Plan de pagos", <span key="t">{v.cuotas.length} cuotas · <strong data-testid="total-propuesta">{formatoMoneda(total, v.moneda)}</strong></span>],
                  ["Cronograma", `${v.cronograma.meses} meses · ${v.cronograma.actividades.length} actividades · desde ${formatoFecha(v.cronograma.fechaInicio)}`],
                  ["3.ª revisión", formatoMoneda(aCentavos(v.precioTercera || "0") ?? 0, v.moneda)],
                  ["Extras", v.extras.filter((e) => e.nombre).map((e) => e.nombre).join(", ") || "Ninguno"],
                  ["Vigencia", `${v.vigenciaDias} días`],
                ].map(([t, d]) => (
                  <div key={t as string} className="rounded-lg bg-surface-2 p-3">
                    <dt className="text-xs font-medium text-muted-foreground">{t}</dt>
                    <dd className="mt-0.5 text-sm font-medium">{d}</dd>
                  </div>
                ))}
                <p className="text-sm text-muted-foreground sm:col-span-2">Al guardar verás la vista previa en PDF y podrás generar el enlace para enviarlo por WhatsApp.</p>
              </dl>
            )}
          </CardContent>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-surface-2/60 px-5 py-3 rounded-b-xl">
            <Button type="button" variant="ghost" disabled={paso === 0} onClick={() => ir(paso - 1)}>
              <ArrowLeft /> Atrás
            </Button>
            <div className="flex flex-wrap gap-2">
              {(id || !ultimo) && (
                <Button type="button" variant="outline" disabled={guardando} onClick={guardar}>
                  <Save /> {id ? "Guardar cambios" : "Guardar borrador"}
                </Button>
              )}
              {!ultimo ? (
                <Button type="button" onClick={siguiente}>
                  Siguiente <ArrowRight />
                </Button>
              ) : (
                !id && (
                  <Button type="button" disabled={guardando} onClick={guardar}>
                    <Check /> {guardando ? "Guardando…" : "Guardar propuesta"}
                  </Button>
                )
              )}
            </div>
          </div>
        </Card>

        <aside className="space-y-4 lg:sticky lg:top-24">
          <Card>
            <CardHeader>
              <CardTitle>Resumen</CardTitle>
              <CardDescription className="line-clamp-2">{v.titulo || "Sin título todavía"}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Total</p>
                <p className="text-2xl font-semibold tracking-tight tabular-nums">{formatoMoneda(total, v.moneda)}</p>
                <p className="text-xs text-muted-foreground">{v.cuotas.length} {v.cuotas.length === 1 ? "cuota" : "cuotas"}</p>
              </div>
              {v.cuotas.length > 0 && (
                <ul className="max-h-48 space-y-1 overflow-y-auto border-t border-border pt-3">
                  {v.cuotas.map((c, i) => (
                    <li key={i} className="flex justify-between gap-2 text-xs">
                      <span className="text-muted-foreground">
                        {i + 1}. {formatoFecha(c.fechaVencimiento)}
                      </span>
                      <span className="tabular-nums">{formatoMoneda(c.montoCentavos, v.moneda)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <dl className="space-y-2 border-t border-border pt-3 text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Estudiante</dt>
                  <dd className="truncate font-medium">{nombreEstudiante || "—"}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Cronograma</dt>
                  <dd className="font-medium">{v.cronograma.actividades.length} actividades</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Vigencia</dt>
                  <dd className="font-medium">{v.vigenciaDias} días</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
