"use client";
import { CheckCircle2, FileUp, UploadCloud, X, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Input } from "./input";

const LIMITE = 50 * 1024 * 1024;
type Estado = { archivo: File; progreso: number; estado: "espera" | "subiendo" | "listo" | "error"; mensaje?: string };

function subir(url: string, fd: FormData, alProgreso: (p: number) => void): Promise<{ ok: boolean; mensaje: string }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => e.lengthComputable && alProgreso(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      try {
        resolve(JSON.parse(xhr.responseText));
      } catch {
        resolve({ ok: false, mensaje: "No pudimos subir el archivo. Inténtalo de nuevo." });
      }
    };
    xhr.onerror = () => resolve({ ok: false, mensaje: "Se cortó la conexión. Revisa tu internet e inténtalo de nuevo." });
    xhr.send(fd);
  });
}

const mb = (b: number) => (b / 1024 / 1024).toFixed(b < 1024 * 1024 ? 2 : 1);

/**
 * Zona para arrastrar y soltar archivos, con barra de progreso por archivo (un archivo por petición).
 * Valida el límite de 50 MB antes de subir; el servidor vuelve a validar tamaño y tipo.
 */
export function ZonaArchivos({
  url,
  campo,
  etiqueta,
  ayuda,
  accept,
  multiple,
  extras,
  textoBoton,
  mensajeExito,
  conDescripcion,
}: {
  url: string;
  campo: string;
  etiqueta: string;
  ayuda: string;
  accept: string;
  multiple?: boolean;
  extras?: Record<string, string>;
  textoBoton: string;
  mensajeExito?: string;
  conDescripcion?: boolean;
}) {
  const router = useRouter();
  const id = React.useId();
  const [lista, setLista] = React.useState<Estado[]>([]);
  const [arrastrando, setArrastrando] = React.useState(false);
  const [descripcion, setDescripcion] = React.useState("");
  const [ocupado, setOcupado] = React.useState(false);
  const [resultado, setResultado] = React.useState<{ ok: boolean; mensaje: string } | null>(null);

  function agregar(files: FileList | File[]) {
    const nuevos = Array.from(files).map<Estado>((archivo) => (archivo.size > LIMITE ? { archivo, progreso: 0, estado: "error", mensaje: `${archivo.name} supera el límite de 50 MB.` } : { archivo, progreso: 0, estado: "espera" }));
    setResultado(null);
    setLista((l) => (multiple ? [...l.filter((x) => x.estado !== "listo"), ...nuevos] : nuevos.slice(0, 1)));
  }

  async function enviar() {
    const pendientes = lista.filter((x) => x.estado === "espera");
    if (!pendientes.length) {
      // Si hay archivos rechazados, su error ya se ve junto a cada uno.
      if (!lista.some((x) => x.estado === "error")) setResultado({ ok: false, mensaje: "Elige un archivo primero." });
      return;
    }
    setOcupado(true);
    let ok = true;
    let ultimo = "";
    for (const it of pendientes) {
      setLista((l) => l.map((x) => (x === it ? { ...x, estado: "subiendo" } : x)));
      const fd = new FormData();
      fd.append(campo, it.archivo);
      for (const [k, v] of Object.entries(extras ?? {})) fd.append(k, v);
      if (conDescripcion) fd.append("descripcion", descripcion);
      const r = await subir(url, fd, (p) => setLista((l) => l.map((x) => (x.archivo === it.archivo ? { ...x, progreso: p } : x))));
      ok &&= r.ok;
      ultimo = r.mensaje;
      setLista((l) => l.map((x) => (x.archivo === it.archivo ? { ...x, progreso: 100, estado: r.ok ? "listo" : "error", mensaje: r.ok ? undefined : r.mensaje } : x)));
    }
    setOcupado(false);
    setResultado({ ok, mensaje: ok ? (mensajeExito ?? ultimo) : (lista.find((x) => x.estado === "error")?.mensaje ?? ultimo) });
    if (ok) {
      setDescripcion("");
      router.refresh();
    }
  }

  return (
    <div className="space-y-3">
      <label
        htmlFor={id}
        onDragOver={(e) => {
          e.preventDefault();
          setArrastrando(true);
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastrando(false);
          if (e.dataTransfer.files.length) agregar(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
          arrastrando ? "border-primary bg-primary-soft" : "border-border-strong bg-surface-2/60 hover:border-primary/50 hover:bg-primary-soft/40",
        )}
      >
        <span className="flex size-12 items-center justify-center rounded-full bg-surface text-primary shadow-sm">
          <UploadCloud className="size-6" aria-hidden />
        </span>
        <span className="text-sm font-semibold">{etiqueta}</span>
        <span className="text-xs text-muted-foreground">
          Arrastra {multiple ? "tus archivos" : "el archivo"} aquí o <span className="font-medium text-primary underline">elige desde tu teléfono</span>
        </span>
        <span className="text-xs text-muted-foreground">{ayuda}</span>
        <input id={id} type="file" className="sr-only" accept={accept} multiple={multiple} onChange={(e) => e.target.files && agregar(e.target.files)} />
      </label>

      {lista.length > 0 && (
        <ul className="space-y-2" aria-live="polite">
          {lista.map((x, i) => (
            <li key={i} className="rounded-xl border border-border bg-surface p-3">
              <div className="flex items-center gap-3">
                {x.estado === "listo" ? <CheckCircle2 className="size-5 shrink-0 text-exito" aria-hidden /> : x.estado === "error" ? <XCircle className="size-5 shrink-0 text-peligro" aria-hidden /> : <FileUp className="size-5 shrink-0 text-subtle-foreground" aria-hidden />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{x.archivo.name}</p>
                  <p className="text-xs text-muted-foreground">{mb(x.archivo.size)} MB</p>
                </div>
                {x.estado === "espera" && (
                  <button type="button" className="rounded-md p-1 text-subtle-foreground hover:bg-muted hover:text-foreground" aria-label={`Quitar ${x.archivo.name}`} onClick={() => setLista((l) => l.filter((_, j) => j !== i))}>
                    <X className="size-4" />
                  </button>
                )}
              </div>
              {(x.estado === "subiendo" || x.estado === "listo") && (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={x.progreso} aria-valuemin={0} aria-valuemax={100} aria-label={`Subiendo ${x.archivo.name}`}>
                  <div className={cn("h-full rounded-full transition-[width]", x.estado === "listo" ? "bg-exito" : "bg-primary")} style={{ width: `${x.progreso}%` }} />
                </div>
              )}
              {x.mensaje && <p className="mt-1.5 text-xs font-medium text-peligro">{x.mensaje}</p>}
            </li>
          ))}
        </ul>
      )}

      {conDescripcion && (
        <div className="space-y-1.5">
          <label htmlFor={`${id}-d`} className="text-sm font-medium">
            Descripción (opcional)
          </label>
          <Input id={`${id}-d`} value={descripcion} maxLength={200} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej. Encuestas aplicadas" />
        </div>
      )}

      {resultado && (
        <p role={resultado.ok ? "status" : "alert"} className={cn("rounded-xl px-3 py-2.5 text-sm font-medium", resultado.ok ? "bg-exito-soft text-exito" : "bg-peligro-soft text-peligro")}>
          {resultado.mensaje}
        </p>
      )}

      <Button type="button" size="lg" className="w-full" disabled={ocupado} onClick={enviar}>
        {ocupado ? "Subiendo…" : textoBoton}
      </Button>
    </div>
  );
}
