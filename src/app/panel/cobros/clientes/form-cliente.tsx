"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Aviso } from "@/components/ui/aviso";
import { Button } from "@/components/ui/button";
import { Campo, Input, Textarea } from "@/components/ui/input";
import { esquemaCliente, type DatosCliente } from "@/modules/cobros/servicios/clientes-esquema";
import { accionActualizarCliente, accionCrearCliente } from "../acciones";

export function FormCliente({ id, inicial, alGuardar }: { id?: string; inicial?: DatosCliente; alGuardar?: (id: string) => void }) {
  const router = useRouter();
  const [res, setRes] = useState<{ ok: boolean; mensaje?: string } | null>(null);
  const { register, handleSubmit, reset, formState } = useForm<DatosCliente>({
    resolver: zodResolver(esquemaCliente) as never,
    defaultValues: inicial ?? { nombre: "", ci: "", whatsapp: "", correo: "", notas: "" },
  });
  const e = formState.errors;

  async function enviar(d: DatosCliente) {
    if (id) {
      const r = await accionActualizarCliente(id, d);
      setRes(r);
      if (r.ok) router.refresh();
      return;
    }
    const r = await accionCrearCliente(d);
    setRes(r);
    if (r.ok) {
      reset();
      if (r.datos && alGuardar) alGuardar(r.datos.id);
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit(enviar)} className="grid gap-4 md:grid-cols-2" noValidate>
      {res && (
        <div className="md:col-span-2">
          <Aviso tipo={res.ok ? "exito" : "error"}>{res.mensaje}</Aviso>
        </div>
      )}
      <Campo etiqueta="Nombre completo" htmlFor="c-nombre" error={e.nombre?.message}>
        <Input id="c-nombre" {...register("nombre")} />
      </Campo>
      <Campo etiqueta="CI" htmlFor="c-ci" error={e.ci?.message}>
        <Input id="c-ci" {...register("ci")} />
      </Campo>
      <Campo etiqueta="Celular WhatsApp (con código de país)" htmlFor="c-wa" ayuda="Ej. 59171234567 o 5568999999999" error={e.whatsapp?.message}>
        <Input id="c-wa" inputMode="tel" {...register("whatsapp")} />
      </Campo>
      <Campo etiqueta="Correo" htmlFor="c-correo" error={e.correo?.message}>
        <Input id="c-correo" type="email" {...register("correo")} />
      </Campo>
      <div className="md:col-span-2">
        <Campo etiqueta="Notas" htmlFor="c-notas" error={e.notas?.message}>
          <Textarea id="c-notas" {...register("notas")} />
        </Campo>
      </div>
      <div>
        <Button type="submit" disabled={formState.isSubmitting}>
          {id ? "Guardar cambios" : "Agregar cliente"}
        </Button>
      </div>
    </form>
  );
}
