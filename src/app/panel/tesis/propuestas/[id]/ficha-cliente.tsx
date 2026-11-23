"use client";
import { MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Aviso } from "@/components/ui/aviso";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
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

type Res = { ok: boolean; mensaje?: string } | null;

export function EnviarPropuesta({ id, reenvio, tieneCi }: { id: string; reenvio: boolean; tieneCi: boolean }) {
  const router = useRouter();
  const [metodo, setMetodo] = useState<"ci" | "pin">(tieneCi ? "ci" : "pin");
  const [res, setRes] = useState<{ url: string; pin: string | null; mensaje: string; whatsapp: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  return (
    <div className="space-y-3">
      {error && <Aviso tipo="error">{error}</Aviso>}
      {res ? (
        <div className="space-y-2">
          <Aviso tipo="exito">Enlace generado. {res.pin && <>PIN: <strong data-testid="pin-portal">{res.pin}</strong> (no se volverá a mostrar).</>}</Aviso>
          <code className="block break-all rounded bg-muted p-2 text-xs" data-testid="url-propuesta">
            {res.url}
          </code>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="whatsapp" size="sm">
              <a href={urlWhatsApp(res.whatsapp, res.mensaje)} target="_blank" rel="noopener noreferrer" data-testid="boton-whatsapp">
                <MessageCircle /> Enviar por WhatsApp
              </a>
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(res.url)}>
              Copiar enlace
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="metodo" checked={metodo === "ci"} disabled={!tieneCi} onChange={() => setMetodo("ci")} /> Acceso con CI
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="metodo" checked={metodo === "pin"} onChange={() => setMetodo("pin")} /> Acceso con PIN
          </label>
          <Button
            disabled={ocupado}
            onClick={async () => {
              setOcupado(true);
              setError(null);
              const r = await accionEnviarPropuesta(id, metodo);
              setOcupado(false);
              if (r.ok && r.datos) {
                setRes(r.datos);
                router.refresh();
              } else if (!r.ok) setError(r.mensaje);
            }}
          >
            {reenvio ? "Reenviar con enlace nuevo" : "Generar enlace y enviar"}
          </Button>
        </div>
      )}
    </div>
  );
}

export function CasillaActividad({ propuestaId, id, nombre, hecha, deshabilitada }: { propuestaId: string; id: string; nombre: string; hecha: boolean; deshabilitada?: boolean }) {
  const router = useRouter();
  const [v, setV] = useState(hecha);
  return (
    <input
      type="checkbox"
      className="size-4"
      aria-label={`Marcar "${nombre}" como hecha`}
      checked={v}
      disabled={deshabilitada}
      onChange={async (e) => {
        setV(e.target.checked);
        await accionMarcarActividad(propuestaId, id, e.target.checked);
        router.refresh();
      }}
    />
  );
}

export function BotonAccion({ etiqueta, accion, variante = "outline", confirmar }: { etiqueta: string; accion: () => Promise<{ ok: boolean; mensaje?: string }>; variante?: "outline" | "default" | "secondary"; confirmar?: string }) {
  const router = useRouter();
  const [res, setRes] = useState<Res>(null);
  const [ocupado, setOcupado] = useState(false);
  return (
    <span className="inline-flex flex-col gap-1">
      <Button
        size="sm"
        variant={variante}
        disabled={ocupado}
        onClick={async () => {
          if (confirmar && !confirm(confirmar)) return;
          setOcupado(true);
          const r = await accion();
          setOcupado(false);
          setRes(r);
          if (r.ok) router.refresh();
        }}
      >
        {etiqueta}
      </Button>
      {res && !res.ok && <span className="text-xs text-destructive">{res.mensaje}</span>}
    </span>
  );
}

export function AccionesProyecto({ id }: { id: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <BotonAccion etiqueta="Pasar a tribunal" accion={() => accionCambiarEstado(id, "tribunal")} />
      <BotonAccion etiqueta="Marcar finalizado" accion={() => accionCambiarEstado(id, "finalizado")} confirmar="¿Marcar el proyecto como finalizado?" />
      <BotonAccion etiqueta="Volver a en curso" accion={() => accionCambiarEstado(id, "en_curso")} />
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
  const [res, setRes] = useState<Res>(null);
  return (
    <div className="space-y-3">
      <EditorCronograma value={v} onChange={setV} />
      {res && <Aviso tipo={res.ok ? "exito" : "error"}>{res.mensaje}</Aviso>}
      <Button
        onClick={async () => {
          const r = await accionProponerCronograma(propuestaId, { fechaInicio: v.fechaInicio, meses: v.meses, actividades: v.actividades.map((a) => ({ nombre: a.nombre, meses: a.meses, aCargoEstudiante: a.aCargoEstudiante, hecha: a.hecha })) });
          setRes(r);
          if (r.ok) router.refresh();
        }}
      >
        Enviar nuevo cronograma al estudiante
      </Button>
    </div>
  );
}

export function Notas({ propuestaId, inicial }: { propuestaId: string; inicial: string }) {
  const [t, setT] = useState(inicial);
  const [res, setRes] = useState<Res>(null);
  return (
    <div className="space-y-2">
      <Textarea aria-label="Notas del proyecto" value={t} onChange={(e) => setT(e.target.value)} rows={4} />
      {res && <Aviso tipo={res.ok ? "exito" : "error"}>{res.mensaje}</Aviso>}
      <Button size="sm" variant="outline" onClick={async () => setRes(await accionGuardarNotas(propuestaId, t))}>
        Guardar notas
      </Button>
    </div>
  );
}
