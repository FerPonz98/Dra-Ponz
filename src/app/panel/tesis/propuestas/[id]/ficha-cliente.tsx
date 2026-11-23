"use client";
import { Copy, KeyRound, MessageCircle, Send, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Aviso } from "@/components/ui/aviso";
import { Button } from "@/components/ui/button";
import { Confirmar } from "@/components/ui/dialogo";
import { Textarea } from "@/components/ui/input";
import { notificar, toast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import { urlWhatsApp } from "@/modules/cobros/dominio/mensajes";
import { EditorCronograma, type ValorCronograma } from "@/modules/tesis/componentes/editor-cronograma";
import {
  accionAprobarSolicitud,
  accionCambiarEstado,
  accionEnviarPropuesta,
  accionGuardarNotas,
  accionMarcarActividad,
  accionMarcarRevision,
  accionProponerCronograma,
} from "../../acciones";

export function EnviarPropuesta({ id, reenvio, tieneCi }: { id: string; reenvio: boolean; tieneCi: boolean }) {
  const router = useRouter();
  const [metodo, setMetodo] = useState<"ci" | "pin">(tieneCi ? "ci" : "pin");
  const [res, setRes] = useState<{ url: string; pin: string | null; mensaje: string; whatsapp: string | null } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  if (res)
    return (
      <div className="space-y-3 rounded-xl border border-exito/30 bg-exito-soft/60 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-exito">
          <ShieldCheck className="size-4" aria-hidden /> Enlace generado
        </p>
        {res.pin && (
          <p className="text-sm">
            PIN: <strong data-testid="pin-portal" className="font-mono text-base tracking-widest">{res.pin}</strong> <span className="text-muted-foreground">(no se volverá a mostrar)</span>
          </p>
        )}
        <code className="block break-all rounded-lg border border-border bg-surface p-2.5 font-mono text-xs" data-testid="url-propuesta">
          {res.url}
        </code>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="whatsapp">
            <a href={urlWhatsApp(res.whatsapp, res.mensaje)} target="_blank" rel="noopener noreferrer" data-testid="boton-whatsapp">
              <MessageCircle /> Enviar por WhatsApp
            </a>
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              await navigator.clipboard.writeText(res.url);
              toast.success("Enlace copiado");
            }}
          >
            <Copy /> Copiar enlace
          </Button>
        </div>
      </div>
    );
  return (
    <div className="space-y-3 rounded-xl border border-dashed border-border-strong p-4">
      <p className="text-sm font-medium">{reenvio ? "Reenviar con un enlace nuevo" : "Enviar al estudiante"}</p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Forma de acceso">
        {(
          [
            ["ci", "Acceso con CI", ShieldCheck],
            ["pin", "Acceso con PIN", KeyRound],
          ] as const
        ).map(([m, t, I]) => (
          <label
            key={m}
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring",
              metodo === m ? "border-primary bg-primary-soft font-medium text-primary" : "border-border",
              m === "ci" && !tieneCi && "cursor-not-allowed opacity-50",
            )}
          >
            <input type="radio" name="metodo" className="sr-only" checked={metodo === m} disabled={m === "ci" && !tieneCi} onChange={() => setMetodo(m)} />
            <I className="size-4" aria-hidden /> {t}
          </label>
        ))}
      </div>
      <Button
        disabled={ocupado}
        onClick={async () => {
          setOcupado(true);
          const r = await accionEnviarPropuesta(id, metodo);
          setOcupado(false);
          if (r.ok && r.datos) {
            setRes(r.datos);
            router.refresh();
          } else notificar(r);
        }}
      >
        <Send /> {reenvio ? "Reenviar con enlace nuevo" : "Generar enlace y enviar"}
      </Button>
    </div>
  );
}

export function CasillaActividad({ propuestaId, id, nombre, hecha, deshabilitada }: { propuestaId: string; id: string; nombre: string; hecha: boolean; deshabilitada?: boolean }) {
  const router = useRouter();
  const [v, setV] = useState(hecha);
  return (
    <input
      type="checkbox"
      className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
      aria-label={`Marcar "${nombre}" como hecha`}
      checked={v}
      disabled={deshabilitada}
      onChange={async (e) => {
        setV(e.target.checked);
        const r = await accionMarcarActividad(propuestaId, id, e.target.checked);
        if (!r.ok) notificar(r);
        router.refresh();
      }}
    />
  );
}

export function BotonAccion({
  etiqueta,
  accion,
  variante = "outline",
  confirmar,
  descripcion,
}: {
  etiqueta: string;
  accion: () => Promise<{ ok: boolean; mensaje?: string }>;
  variante?: "outline" | "default" | "secondary" | "exito";
  confirmar?: string;
  descripcion?: string;
}) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const correr = async () => {
    setOcupado(true);
    const r = await accion();
    setOcupado(false);
    notificar(r);
    if (r.ok) router.refresh();
  };
  if (confirmar)
    return (
      <Confirmar
        disparador={
          <Button size="sm" variant={variante} disabled={ocupado}>
            {etiqueta}
          </Button>
        }
        titulo={confirmar}
        descripcion={descripcion}
        confirmar={etiqueta}
        alConfirmar={correr}
      />
    );
  return (
    <Button size="sm" variant={variante} disabled={ocupado} onClick={correr}>
      {etiqueta}
    </Button>
  );
}

export function AccionesProyecto({ id, estado }: { id: string; estado: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {estado !== "tribunal" && <BotonAccion etiqueta="Pasar a tribunal" accion={() => accionCambiarEstado(id, "tribunal")} />}
      {estado !== "finalizado" && (
        <BotonAccion etiqueta="Marcar finalizado" accion={() => accionCambiarEstado(id, "finalizado")} confirmar="¿Marcar el proyecto como finalizado?" descripcion="Úsalo cuando el estudiante ya defendió su tesis." />
      )}
      {(estado === "tribunal" || estado === "finalizado") && <BotonAccion etiqueta="Volver a en curso" accion={() => accionCambiarEstado(id, "en_curso")} />}
    </div>
  );
}

export function BotonRevision({ propuestaId, id, hecha }: { propuestaId: string; id: string; hecha: boolean }) {
  return <BotonAccion etiqueta={hecha ? "Desmarcar" : "Marcar hecha"} accion={() => accionMarcarRevision(propuestaId, id, !hecha)} />;
}

export function BotonAprobar({ propuestaId, tipo, refId }: { propuestaId: string; tipo: "revision" | "extra"; refId: string }) {
  return <BotonAccion etiqueta="Aprobar y cobrar" variante="default" accion={() => accionAprobarSolicitud(propuestaId, tipo, refId)} />;
}

export function NuevoCronograma({ propuestaId, inicial }: { propuestaId: string; inicial: ValorCronograma }) {
  const router = useRouter();
  const [v, setV] = useState(inicial);
  const [res, setRes] = useState<{ ok: boolean; mensaje?: string } | null>(null);
  return (
    <div className="space-y-4">
      <EditorCronograma value={v} onChange={setV} />
      {res && !res.ok && <Aviso tipo="error">{res.mensaje}</Aviso>}
      <Button
        onClick={async () => {
          const r = await accionProponerCronograma(propuestaId, { fechaInicio: v.fechaInicio, meses: v.meses, actividades: v.actividades.map((a) => ({ nombre: a.nombre, meses: a.meses, aCargoEstudiante: a.aCargoEstudiante, hecha: a.hecha })) });
          setRes(r);
          notificar(r);
          if (r.ok) router.refresh();
        }}
      >
        <Send /> Enviar nuevo cronograma al estudiante
      </Button>
    </div>
  );
}

export function Notas({ propuestaId, inicial }: { propuestaId: string; inicial: string }) {
  const [t, setT] = useState(inicial);
  const [guardado, setGuardado] = useState(inicial);
  return (
    <div className="space-y-2">
      <Textarea aria-label="Notas del proyecto" value={t} onChange={(e) => setT(e.target.value)} rows={4} placeholder="Notas privadas: acuerdos, observaciones del tribunal, pendientes…" />
      <Button
        size="sm"
        variant="outline"
        disabled={t === guardado}
        onClick={async () => {
          const r = await accionGuardarNotas(propuestaId, t);
          notificar(r);
          if (r.ok) setGuardado(t);
        }}
      >
        Guardar notas
      </Button>
    </div>
  );
}
