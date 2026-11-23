"use client";
import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Aviso } from "@/components/ui/aviso";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Campo, Input, Select } from "@/components/ui/input";
import { aCentavos, formatoMoneda } from "@/lib/dinero";
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

const PASOS = ["Datos", "Moneda", "Plan de pagos", "Cronograma", "Mora", "Revisiones", "Extras", "Formulario", "Vigencia", "Vista previa"];

type Props = {
  inicial: ValorAsistente;
  id?: string;
  estudiantes: { id: string; nombre: string }[];
  formularios: { id: string; nombre: string }[];
  hoy: string;
};

export function AsistentePropuesta({ inicial, id, estudiantes, formularios, hoy }: Props) {
  const router = useRouter();
  const [v, setV] = useState<ValorAsistente>(inicial);
  const [paso, setPaso] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const set = (c: Partial<ValorAsistente>) => setV((x) => ({ ...x, ...c }));
  const total = v.cuotas.reduce((s, c) => s + c.montoCentavos, 0);

  async function guardar() {
    setGuardando(true);
    setError(null);
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
      router.push(`/panel/tesis/propuestas/${r.datos.id}`);
      router.refresh();
    } else if (!r.ok) setError(r.mensaje);
  }

  return (
    <div className="space-y-4">
      <nav aria-label="Pasos" className="-mx-1 flex gap-1 overflow-x-auto pb-1">
        {PASOS.map((t, i) => (
          <button
            key={t}
            type="button"
            onClick={() => setPaso(i)}
            aria-current={paso === i ? "step" : undefined}
            className={cn("shrink-0 rounded-full border px-3 py-1 text-xs", paso === i ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted")}
          >
            {i + 1}. {t}
          </button>
        ))}
      </nav>
      {error && <Aviso tipo="error">{error}</Aviso>}
      <Card>
        <CardHeader>
          <CardTitle>
            Paso {paso + 1} de {PASOS.length}: {PASOS[paso]}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {paso === 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Campo etiqueta="Nombre del proyecto o tema" htmlFor="a-titulo">
                  <Input id="a-titulo" value={v.titulo} onChange={(e) => set({ titulo: e.target.value })} />
                </Campo>
              </div>
              <fieldset className="space-y-2 md:col-span-2">
                <legend className="text-sm font-medium">Estudiante</legend>
                <div className="flex gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="radio" name="modo" checked={v.modoEstudiante === "existente"} onChange={() => set({ modoEstudiante: "existente" })} /> Existente
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" name="modo" checked={v.modoEstudiante === "nuevo"} onChange={() => set({ modoEstudiante: "nuevo" })} /> Nuevo
                  </label>
                </div>
                {v.modoEstudiante === "existente" ? (
                  <Select aria-label="Estudiante" value={v.clienteId} onChange={(e) => set({ clienteId: e.target.value })}>
                    <option value="">Elige…</option>
                    {estudiantes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Campo etiqueta="Nombre del estudiante" htmlFor="a-est-nombre">
                      <Input id="a-est-nombre" value={v.nuevo.nombre} onChange={(e) => set({ nuevo: { ...v.nuevo, nombre: e.target.value } })} />
                    </Campo>
                    <Campo etiqueta="CI del estudiante" htmlFor="a-est-ci">
                      <Input id="a-est-ci" value={v.nuevo.ci} onChange={(e) => set({ nuevo: { ...v.nuevo, ci: e.target.value } })} />
                    </Campo>
                    <Campo etiqueta="WhatsApp del estudiante" htmlFor="a-est-wa" ayuda="Con código de país">
                      <Input id="a-est-wa" inputMode="tel" value={v.nuevo.whatsapp} onChange={(e) => set({ nuevo: { ...v.nuevo, whatsapp: e.target.value } })} />
                    </Campo>
                    <Campo etiqueta="Correo del estudiante" htmlFor="a-est-correo">
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
            <Campo etiqueta="Moneda de la propuesta" htmlFor="a-moneda" ayuda="Si es BRL, el estudiante paga en Bs al tipo de cambio oficial del día del pago.">
              <Select id="a-moneda" value={v.moneda} onChange={(e) => set({ moneda: e.target.value as ValorAsistente["moneda"] })}>
                <option value="BOB">Bolivianos (BOB)</option>
                <option value="BRL">Reales (BRL)</option>
              </Select>
            </Campo>
          )}
          {paso === 2 && <EditorCuotas value={v.cuotas} onChange={(cuotas) => set({ cuotas })} moneda={v.moneda} hoy={hoy} />}
          {paso === 3 && <EditorCronograma value={v.cronograma} onChange={(cronograma) => set({ cronograma })} />}
          {paso === 4 && <EditorReglas value={v.reglas} onChange={(reglas) => set({ reglas })} />}
          {paso === 5 && (
            <div className="space-y-3">
              <p className="text-sm">La propuesta incluye <strong>2 revisiones del tribunal</strong>. La 3.ª se cobra aparte si el estudiante la pide.</p>
              <Campo etiqueta={`Precio de la 3.ª revisión (${v.moneda})`} htmlFor="a-rev3">
                <Input id="a-rev3" inputMode="decimal" value={v.precioTercera} onChange={(e) => set({ precioTercera: e.target.value })} />
              </Campo>
            </div>
          )}
          {paso === 6 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Extras opcionales que el estudiante puede pedir. La defensa no es un extra: la hace el estudiante.</p>
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
            <Campo etiqueta="Formulario de recolección de datos" htmlFor="a-form" ayuda={formularios.length ? undefined : "Aún no creaste formularios (menú Formularios)."}>
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
            <Campo etiqueta="Vigencia del enlace (días)" htmlFor="a-vig" ayuda="Si el estudiante no acepta en este plazo, el enlace se destruye y la propuesta queda vencida (podrás editarla y reenviarla).">
              <Input id="a-vig" type="number" min={1} max={90} value={v.vigenciaDias} onChange={(e) => set({ vigenciaDias: Number(e.target.value) })} />
            </Campo>
          )}
          {paso === 9 && (
            <div className="space-y-2 text-sm">
              <p>
                <strong>{v.titulo || "(sin título)"}</strong> · {v.nivel} · {v.universidad || "—"}
              </p>
              <p>Estudiante: {v.modoEstudiante === "nuevo" ? v.nuevo.nombre || "—" : (estudiantes.find((e) => e.id === v.clienteId)?.nombre ?? "—")}</p>
              <p>
                Plan: {v.cuotas.length} cuotas · total <strong data-testid="total-propuesta">{formatoMoneda(total, v.moneda)}</strong>
              </p>
              <p>
                Cronograma: {v.cronograma.meses} meses, {v.cronograma.actividades.length} actividades, desde {v.cronograma.fechaInicio}
              </p>
              <p>3.ª revisión: {formatoMoneda(aCentavos(v.precioTercera || "0") ?? 0, v.moneda)} · Extras: {v.extras.filter((e) => e.nombre).map((e) => e.nombre).join(", ") || "ninguno"}</p>
              <p>Vigencia: {v.vigenciaDias} días</p>
              <p className="text-muted-foreground">Al guardar verás la vista previa en PDF, podrás generar el enlace y enviarlo por WhatsApp.</p>
            </div>
          )}
        </CardContent>
      </Card>
      <div className="flex flex-wrap justify-between gap-2">
        <Button type="button" variant="outline" disabled={paso === 0} onClick={() => setPaso((p) => p - 1)}>
          Atrás
        </Button>
        <div className="flex gap-2">
          {paso < PASOS.length - 1 && (
            <Button type="button" onClick={() => setPaso((p) => p + 1)}>
              Siguiente
            </Button>
          )}
          {(paso === PASOS.length - 1 || id) && (
            <Button type="button" variant={paso === PASOS.length - 1 ? "default" : "secondary"} disabled={guardando} onClick={guardar}>
              {guardando ? "Guardando…" : id ? "Guardar cambios" : "Guardar propuesta"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
