"use client";
import { useActionState } from "react";
import type { Resultado } from "@/lib/acciones";
import { Aviso } from "@/components/ui/aviso";
import { Button } from "@/components/ui/button";
import { Campo, Input, Select, Textarea } from "@/components/ui/input";
import { ACEPTA_POR_TIPO, type TipoCampo } from "@/modules/tesis/dominio/campos";

type Accion = (estado: Resultado | null, fd: FormData) => Promise<Resultado>;
export type CampoPortal = { id: string; tipo: TipoCampo; etiqueta: string; ayuda: string | null; obligatorio: boolean; opciones: string[] };

/** Formulario dinámico del estudiante (paso 3). Los archivos se validan en el servidor (tipo y 50 MB). */
export function FormularioPortal({ campos, descripcion, accion, enviado }: { campos: CampoPortal[]; descripcion: string | null; accion: Accion; enviado: boolean }) {
  const [estado, enviar, pendiente] = useActionState(accion, null);
  return (
    <form action={enviar} className="space-y-4">
      {descripcion && <p className="text-sm text-muted-foreground">{descripcion}</p>}
      {enviado && !estado && <Aviso tipo="exito">Ya enviaste este formulario. Puedes volver a enviarlo para corregir.</Aviso>}
      {estado && <Aviso tipo={estado.ok ? "exito" : "error"}>{estado.mensaje}</Aviso>}
      {campos.map((c) => {
        const id = `campo_${c.id}`;
        const etiqueta = `${c.etiqueta}${c.obligatorio ? " *" : ""}`;
        return (
          <Campo key={c.id} etiqueta={etiqueta} htmlFor={id} ayuda={c.ayuda ?? (c.tipo === "zip" || c.tipo === "archivo" ? "Máximo 50 MB" : undefined)}>
            {c.tipo === "texto_corto" && <Input id={id} name={id} required={c.obligatorio} maxLength={300} />}
            {c.tipo === "texto_largo" && <Textarea id={id} name={id} required={c.obligatorio} maxLength={10000} rows={4} />}
            {c.tipo === "fecha" && <Input id={id} name={id} type="date" required={c.obligatorio} />}
            {c.tipo === "seleccion" && (
              <Select id={id} name={id} required={c.obligatorio} defaultValue="">
                <option value="">Elige…</option>
                {c.opciones.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </Select>
            )}
            {(c.tipo === "archivo" || c.tipo === "zip") && <Input id={id} name={id} type="file" accept={ACEPTA_POR_TIPO[c.tipo]} required={c.obligatorio} className="rounded-xl border-dashed bg-surface-2/60" />}
          </Campo>
        );
      })}
      <Button type="submit" size="lg" disabled={pendiente} className="h-14 w-full rounded-2xl text-base">
        {pendiente ? "Enviando…" : "Enviar formulario"}
      </Button>
    </form>
  );
}
