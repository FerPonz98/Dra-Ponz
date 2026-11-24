import { ArrowRight, FileStack, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { requerirModulo } from "@/core/contexto";
import { Aviso } from "@/components/ui/aviso";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EncabezadoPagina, EstadoVacio } from "@/components/ui/varios";
import { withOrg } from "@/lib/db";
import { listarFormularios } from "@/modules/tesis/servicios/formularios";

export const metadata: Metadata = { title: "Formularios" };

export default async function FormulariosPage(props: { searchParams: Promise<{ eliminado?: string }> }) {
  const { eliminado } = await props.searchParams;
  const ctx = await requerirModulo("tesis", "tesis:editar");
  const lista = await withOrg(ctx.organizacion.id, (tx) => listarFormularios(tx));
  const boton = (
    <Button asChild>
      <Link href="/panel/tesis/formularios/nuevo">
        <Plus /> Nuevo formulario
      </Link>
    </Button>
  );
  return (
    <div>
      <EncabezadoPagina ayuda="formularios" titulo="Formularios" descripcion="Formularios reutilizables para recolectar datos y archivos del estudiante. Se eligen en el paso 8 de cada propuesta." acciones={lista.length > 0 && boton} />
      {eliminado && <Aviso tipo="exito" className="mb-4">Formulario eliminado.</Aviso>}
      {lista.length === 0 ? (
        <Card>
          <EstadoVacio icono={FileStack} titulo="Crea tu primer formulario" descripcion="Textos, fechas, opciones y archivos (PDF, Word, Excel o ZIP de hasta 50 MB)." accion={boton} />
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {lista.map((f) => (
            <li key={f.id}>
              <Link href={`/panel/tesis/formularios/${f.id}`} className="group flex h-full flex-col rounded-xl border border-border bg-surface p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
                <span className="mb-4 flex size-10 items-center justify-center rounded-lg bg-primary-soft text-primary">
                  <FileStack className="size-5" aria-hidden />
                </span>
                <span className="font-semibold">{f.nombre}</span>
                {f.descripcion && <span className="mt-1 line-clamp-2 text-sm text-muted-foreground">{f.descripcion}</span>}
                <span className="mt-auto flex items-center justify-between pt-4 text-sm text-muted-foreground">
                  {f.campos} {f.campos === 1 ? "campo" : "campos"}
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
