"use client";
import { AlertTriangle, Check, CheckCircle2, GraduationCap, RotateCcw, ShieldCheck, Undo2 } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { Aviso } from "@/components/ui/aviso";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Confirmar } from "@/components/ui/dialogo";
import { Input, Interruptor, Label } from "@/components/ui/input";
import { notificar } from "@/components/ui/toaster";
import { normalizarHex } from "@/core/tema/colores";
import {
  FUENTES_TEXTO,
  FUENTES_TITULOS,
  PRESETS,
  presetDe,
  RADIOS,
  TEMA_POR_DEFECTO,
  variablesPlataforma,
  variablesTema,
  verificarContraste,
  type CampoColor,
  type Tema,
} from "@/core/tema/tema";
import { cn } from "@/lib/utils";
import { accionGuardarTema } from "./acciones";

const COLORES: { campo: CampoColor; etiqueta: string; ayuda: string }[] = [
  { campo: "colorPrimario", etiqueta: "Primario", ayuda: "Botones, enlaces y acentos" },
  { campo: "colorSecundario", etiqueta: "Secundario", ayuda: "Títulos y franjas oscuras" },
  { campo: "colorAcento", etiqueta: "Acento", ayuda: "Íconos, detalles y cifras" },
  { campo: "colorFondo", etiqueta: "Fondo", ayuda: "Fondo de la página" },
  { campo: "colorTexto", etiqueta: "Texto", ayuda: "Párrafos y textos" },
];

const iguales = (a: Tema, b: Tema) => (Object.keys(a) as (keyof Tema)[]).every((k) => k === "preset" || String(a[k]).toLowerCase() === String(b[k]).toLowerCase());

export function EditorApariencia({ guardado: inicial, nombre }: { guardado: Tema; nombre: string }) {
  const [guardado, setGuardado] = useState(inicial);
  const [tema, setTema] = useState(inicial);
  const [pendiente, iniciar] = useTransition();
  const verificaciones = useMemo(() => verificarContraste(tema), [tema]);
  const bloqueos = verificaciones.filter((v) => v.bloqueante && !v.ok);
  const cambios = !iguales(tema, guardado);
  const presetActual = presetDe(tema);

  const cambiar = (parcial: Partial<Tema>) => setTema((t) => ({ ...t, ...parcial }));

  const guardar = () =>
    iniciar(async () => {
      const r = await accionGuardarTema({ ...tema, preset: presetActual });
      notificar(r);
      if (r.ok && r.datos) {
        setGuardado(r.datos);
        setTema(r.datos);
      }
    });

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Combinaciones listas</CardTitle>
            <CardDescription>Un clic y listo. Todas cumplen el contraste recomendado (WCAG AA).</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {PRESETS.map((p) => {
                const activo = presetActual === p.id;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      aria-pressed={activo}
                      data-testid={`preset-${p.id}`}
                      onClick={() => setTema((t) => ({ ...p.tema, preset: p.id, introActiva: t.introActiva }))}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-muted",
                        activo ? "border-primary bg-primary-soft ring-1 ring-primary" : "border-border bg-surface",
                      )}
                    >
                      <span className="flex shrink-0 overflow-hidden rounded-lg border border-border" aria-hidden>
                        {[p.tema.colorPrimario, p.tema.colorSecundario, p.tema.colorAcento, p.tema.colorFondo].map((c) => (
                          <span key={c} className="block h-9 w-4" style={{ background: c }} />
                        ))}
                      </span>
                      <span className="min-w-0 flex-1 text-sm font-medium leading-tight">{p.nombre}</span>
                      {activo && <Check className="size-4 shrink-0 text-primary" aria-label="elegido" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Colores</CardTitle>
            <CardDescription>Las variantes (hover, fondos suaves, bordes y el texto sobre cada color) se calculan solas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {COLORES.map(({ campo, etiqueta, ayuda }) => (
              <SelectorColor key={campo} id={`c-${campo}`} etiqueta={etiqueta} ayuda={ayuda} valor={tema[campo]} alCambiar={(v) => cambiar({ [campo]: v })} />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contraste</CardTitle>
            <CardDescription>Se revisa automáticamente para que todo se lea bien, también en el celular y al sol.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {bloqueos.length > 0 && (
              <Aviso tipo="error" titulo="Hay combinaciones que no se leen bien">
                Corrígelas para poder guardar. Puedes aplicar la sugerencia con un clic.
              </Aviso>
            )}
            <ul className="divide-y divide-border rounded-xl border border-border" data-testid="contraste">
              {verificaciones.map((v) => (
                <li key={v.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                  <span className="flex shrink-0 overflow-hidden rounded-md border border-border" aria-hidden>
                    <span className="flex size-8 items-center justify-center" style={{ background: v.colores[1] }}>
                      <span className="block h-1.5 w-4 rounded-full" style={{ background: v.colores[0] }} />
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{v.etiqueta}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {v.relacion.toFixed(2)}:1 · mínimo {v.minimo}:1
                    </span>
                  </span>
                  {v.ok ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-exito">
                      <CheckCircle2 className="size-4" aria-hidden /> Se lee bien
                    </span>
                  ) : (
                    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", v.bloqueante ? "text-peligro" : "text-aviso")}>
                      <AlertTriangle className="size-4" aria-hidden /> {v.bloqueante ? "No se lee bien" : "Aviso"}
                    </span>
                  )}
                  {v.sugerencia && (
                    <div className="flex w-full items-center justify-between gap-3 rounded-lg bg-surface-2 px-3 py-2 text-xs">
                      <span>
                        {v.sugerencia.texto}: <strong className="font-mono">{v.sugerencia.valor}</strong>
                      </span>
                      <Button type="button" size="sm" variant="outline" onClick={() => cambiar({ [v.sugerencia!.campo]: v.sugerencia!.valor })}>
                        <span className="size-3 rounded-sm border border-border" style={{ background: v.sugerencia.valor }} aria-hidden />
                        Usar sugerencia
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tipografía y bordes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <GrupoOpciones
              titulo="Fuente de los títulos"
              nombre="fuenteTitulos"
              valor={tema.fuenteTitulos}
              opciones={FUENTES_TITULOS.map((f) => ({ id: f.id, nombre: f.nombre, muestra: <span style={{ fontFamily: `var(${f.variable}), serif` }} className="text-xl">Aa Tesis</span> }))}
              alCambiar={(v) => cambiar({ fuenteTitulos: v as Tema["fuenteTitulos"] })}
            />
            <GrupoOpciones
              titulo="Fuente del texto"
              nombre="fuenteTexto"
              valor={tema.fuenteTexto}
              opciones={FUENTES_TEXTO.map((f) => ({ id: f.id, nombre: f.nombre, muestra: <span style={{ fontFamily: `var(${f.variable}), sans-serif` }} className="text-base">Aa Texto</span> }))}
              alCambiar={(v) => cambiar({ fuenteTexto: v as Tema["fuenteTexto"] })}
            />
            <GrupoOpciones
              titulo="Bordes"
              nombre="radioBordes"
              valor={tema.radioBordes}
              opciones={RADIOS.map((r) => ({ id: r.id, nombre: r.nombre, muestra: <span className="block h-7 w-14 border-2 border-foreground/60 bg-surface-2" style={{ borderRadius: r.boton }} /> }))}
              alCambiar={(v) => cambiar({ radioBordes: v as Tema["radioBordes"] })}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Intro de la landing</CardTitle>
            <CardDescription>Una presentación corta (≤ 2,2 s) con tu monograma la primera vez que alguien entra en la sesión. Se salta con un clic, con Esc o con el botón Saltar. Nunca la ven los buscadores ni quien pidió menos movimiento.</CardDescription>
          </CardHeader>
          <CardContent>
            <Interruptor id="intro-activa" checked={tema.introActiva !== false} onChange={(v) => cambiar({ introActiva: v })} etiqueta="Mostrar la intro animada" />
          </CardContent>
        </Card>

        <div className="sticky bottom-20 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface/95 p-3 shadow-lg backdrop-blur md:bottom-4">
          <Button type="button" onClick={guardar} disabled={!cambios || bloqueos.length > 0 || pendiente} data-testid="guardar-apariencia">
            {pendiente ? "Guardando…" : "Guardar"}
          </Button>
          <Button type="button" variant="outline" onClick={() => setTema(guardado)} disabled={!cambios || pendiente}>
            <Undo2 aria-hidden /> Descartar cambios
          </Button>
          <Confirmar
            disparador={
              <Button type="button" variant="ghost" disabled={pendiente || iguales(tema, TEMA_POR_DEFECTO)}>
                <RotateCcw aria-hidden /> Restaurar valores por defecto
              </Button>
            }
            titulo="¿Restaurar los valores por defecto?"
            descripcion="Se cargan los colores, fuentes y bordes originales (Académico azul petróleo). Revisa la vista previa y pulsa Guardar para aplicarlos."
            confirmar="Restaurar"
            alConfirmar={() => setTema(TEMA_POR_DEFECTO)}
          />
          <span className="ml-auto text-xs text-muted-foreground" aria-live="polite">
            {bloqueos.length > 0 ? "Corrige el contraste para guardar" : cambios ? "Cambios sin guardar" : "Todo guardado"}
          </span>
        </div>
      </div>

      <VistaPrevia tema={tema} nombre={nombre} />
    </div>
  );
}

function SelectorColor({ id, etiqueta, ayuda, valor, alCambiar }: { id: string; etiqueta: string; ayuda: string; valor: string; alCambiar: (v: string) => void }) {
  const [texto, setTexto] = useState(valor);
  const [anterior, setAnterior] = useState(valor);
  if (valor !== anterior) {
    setAnterior(valor);
    setTexto(valor);
  }
  const valido = normalizarHex(texto) !== null;
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 sm:grid-cols-[10rem_1fr_auto]">
      <div className="col-span-2 sm:col-span-1">
        <Label htmlFor={id}>{etiqueta}</Label>
        <p className="text-xs text-muted-foreground">{ayuda}</p>
      </div>
      <Input
        id={id}
        value={texto}
        spellCheck={false}
        maxLength={7}
        aria-invalid={!valido || undefined}
        aria-describedby={valido ? undefined : `${id}-error`}
        className="font-mono uppercase"
        onChange={(e) => {
          setTexto(e.target.value);
          const h = normalizarHex(e.target.value);
          if (h && h.length === 7 && /^#?[0-9a-f]{6}$/i.test(e.target.value.trim())) alCambiar(h);
        }}
        onBlur={() => setTexto(valor)}
      />
      <input
        type="color"
        value={valor}
        onChange={(e) => alCambiar(e.target.value.toLowerCase())}
        aria-label={`${etiqueta}: elegir color`}
        className="h-10 w-14 cursor-pointer rounded-lg border border-border-strong bg-surface p-1"
      />
      {!valido && (
        <p id={`${id}-error`} role="alert" className="col-span-full text-xs text-peligro">
          Usa un color HEX como #1a2b3c
        </p>
      )}
    </div>
  );
}

function GrupoOpciones({ titulo, nombre, valor, opciones, alCambiar }: { titulo: string; nombre: string; valor: string; opciones: { id: string; nombre: string; muestra: React.ReactNode }[]; alCambiar: (v: string) => void }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{titulo}</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {opciones.map((o) => (
          <label
            key={o.id}
            className={cn(
              "flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border p-3 text-center text-xs transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
              valor === o.id ? "border-primary bg-primary-soft" : "border-border hover:bg-muted",
            )}
          >
            <input type="radio" name={nombre} value={o.id} checked={valor === o.id} onChange={() => alCambiar(o.id)} className="sr-only" />
            {o.muestra}
            <span className="font-medium">{o.nombre}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Miniatura en vivo: portada de la landing y una tarjeta del portal con el tema que se está editando. */
function VistaPrevia({ tema, nombre }: { tema: Tema; nombre: string }) {
  const estilo = { ...variablesTema(tema), ...variablesPlataforma(tema, "portal") } as React.CSSProperties;
  return (
    <aside aria-label="Vista previa" className="space-y-4 lg:sticky lg:top-20">
      <p className="text-sm font-medium text-muted-foreground">Vista previa en vivo</p>
      <div style={estilo} className="space-y-4 [color-scheme:light]" data-testid="vista-previa">
        {/* Landing */}
        <div className="overflow-hidden rounded-xl border border-border shadow-md">
          <div className="flex items-center gap-1.5 border-b border-border bg-surface-2 px-3 py-2" aria-hidden>
            <span className="size-2 rounded-full bg-[#ef4444]/60" />
            <span className="size-2 rounded-full bg-[#f59e0b]/60" />
            <span className="size-2 rounded-full bg-[#22c55e]/60" />
            <span className="ml-2 truncate text-[10px] text-muted-foreground">Tu landing</span>
          </div>
          <div className="relative overflow-hidden bg-tema-fondo font-texto text-tema-texto">
            <div aria-hidden className="absolute -right-10 -top-10 size-40 rounded-full bg-tema-primario-suave blur-2xl" />
            <div className="relative flex items-center justify-between px-4 py-2.5">
              <span className="font-titulos text-xs font-semibold text-tema-titulo">{nombre.replace(/^(Dra\. Elizabeth Julieta)/, "Dra. Julieta")}</span>
              <span className="rounded-full bg-tema-primario px-2 py-0.5 text-[9px] font-semibold text-tema-sobre-primario">ES</span>
            </div>
            <div className="relative space-y-3 px-4 pb-5 pt-2">
              <p className="inline-block rounded-full border border-tema-acento/40 bg-tema-superficie/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-tema-acento-texto">Pregrado y posgrado</p>
              <p className="font-titulos text-xl font-medium leading-tight text-tema-titulo">Tu tesis, de la idea a la defensa.</p>
              <p className="text-xs leading-relaxed text-tema-texto-suave">Acompañamiento metodológico con quien sabe lo que el tribunal va a observar.</p>
              <span data-testid="vista-previa-boton" className="inline-flex items-center gap-1.5 rounded-boton bg-tema-primario px-3.5 py-2 text-xs font-semibold text-tema-sobre-primario shadow-md">
                Quiero un diagnóstico
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  [ShieldCheck, "CEUB"],
                  [GraduationCap, "UAP"],
                ].map(([I, t]) => {
                  const Icono = I as typeof ShieldCheck;
                  return (
                    <span key={t as string} className="inline-flex items-center gap-1 rounded-full border border-tema-primario-borde bg-tema-superficie/80 px-2 py-0.5 text-[10px] font-medium text-tema-primario-texto">
                      <Icono className="size-3 text-tema-acento-texto" aria-hidden /> {t as string}
                    </span>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-3 bg-tema-secundario px-2 py-3 text-center">
              {[
                ["29", "años"],
                ["58", "tesis"],
                ["45+", "estudiantes"],
              ].map(([n, t]) => (
                <div key={t}>
                  <p className="font-titulos text-lg text-tema-acento-sobre-secundario">{n}</p>
                  <p className="text-[9px] text-tema-sobre-secundario-suave">{t}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 p-3">
              {["Asesoría integral", "Revisión"].map((s) => (
                <div key={s} className="rounded-tarjeta border border-tema-borde bg-tema-superficie p-2.5">
                  <span className="mb-1.5 block size-5 rounded-md bg-tema-primario" aria-hidden />
                  <p className="font-titulos text-xs text-tema-titulo">{s}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Portal */}
        <div className="overflow-hidden rounded-xl border border-border bg-background p-3 font-texto shadow-md">
          <p className="mb-2 text-[10px] text-muted-foreground">Portal de tus clientes</p>
          <div className="space-y-3 rounded-3xl border border-border bg-surface p-4 shadow-sm">
            <p className="font-titulos text-sm font-semibold text-foreground">Tu plan de pago</p>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Cuota 2 de 4</span>
              <span className="font-semibold tabular-nums text-foreground">Bs 450,00</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
              <div className="h-full w-1/2 rounded-full bg-primary" />
            </div>
            <span className="flex h-9 items-center justify-center rounded-xl bg-primary text-xs font-semibold text-primary-foreground">Ya pagué, subir comprobante</span>
            <span className="block text-center text-xs font-medium text-primary">Ver mis cuotas</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
