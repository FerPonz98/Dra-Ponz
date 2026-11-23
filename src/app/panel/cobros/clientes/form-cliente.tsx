"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { PanelLateral } from "@/components/ui/dialogo";
import { Campo, Input, Textarea } from "@/components/ui/input";
import { notificar } from "@/components/ui/toaster";
import { esquemaCliente, type DatosCliente } from "@/modules/cobros/servicios/clientes-esquema";
import { accionActualizarCliente, accionCrearCliente } from "../acciones";

export function FormCliente({ id, inicial, alGuardar }: { id?: string; inicial?: DatosCliente; alGuardar?: (id: string) => void }) {
  const router = useRouter();
  const { register, handleSubmit, reset, formState } = useForm<DatosCliente>({
    resolver: zodResolver(esquemaCliente) as never,
    defaultValues: inicial ?? { nombre: "", ci: "", whatsapp: "", correo: "", notas: "" },
    mode: "onBlur",
  });
  const e = formState.errors;

  async function enviar(d: DatosCliente) {
    if (id) {
      const r = await accionActualizarCliente(id, d);
      notificar(r);
      if (r.ok) router.refresh();
      return;
    }
    const r = await accionCrearCliente(d);
    notificar(r);
    if (r.ok) {
      reset();
      if (r.datos && alGuardar) alGuardar(r.datos.id);
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit(enviar)} className="grid gap-4 sm:grid-cols-2" noValidate>
      <Campo etiqueta="Nombre completo" htmlFor="c-nombre" error={e.nombre?.message} className="sm:col-span-2">
        <Input id="c-nombre" autoComplete="off" aria-invalid={!!e.nombre} {...register("nombre")} />
      </Campo>
      <Campo etiqueta="CI" htmlFor="c-ci" error={e.ci?.message}>
        <Input id="c-ci" aria-invalid={!!e.ci} {...register("ci")} />
      </Campo>
      <Campo etiqueta="Celular WhatsApp (con código de país)" htmlFor="c-wa" ayuda="Ej. 59171234567 o 5568999999999" error={e.whatsapp?.message}>
        <Input id="c-wa" inputMode="tel" aria-invalid={!!e.whatsapp} {...register("whatsapp")} />
      </Campo>
      <Campo etiqueta="Correo" htmlFor="c-correo" error={e.correo?.message} className="sm:col-span-2" ayuda="Para enviarle recordatorios automáticos.">
        <Input id="c-correo" type="email" aria-invalid={!!e.correo} {...register("correo")} />
      </Campo>
      <Campo etiqueta="Notas" htmlFor="c-notas" error={e.notas?.message} className="sm:col-span-2">
        <Textarea id="c-notas" rows={3} {...register("notas")} />
      </Campo>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={formState.isSubmitting} className="w-full sm:w-auto">
          {formState.isSubmitting ? "Guardando…" : id ? "Guardar cambios" : "Agregar cliente"}
        </Button>
      </div>
    </form>
  );
}

export function NuevoCliente() {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <Button onClick={() => setAbierto(true)}>
        <Plus /> Nuevo cliente
      </Button>
      <PanelLateral abierto={abierto} alCambiar={setAbierto} titulo="Nuevo cliente" descripcion="Solo el nombre es obligatorio; el CI permite que entre a su portal.">
        <FormCliente alGuardar={() => setAbierto(false)} />
      </PanelLateral>
    </>
  );
}
