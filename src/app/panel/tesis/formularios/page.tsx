import type { Metadata } from "next";
import Link from "next/link";
import { requerirModulo } from "@/core/contexto";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { withOrg } from "@/lib/db";
import { listarFormularios } from "@/modules/tesis/servicios/formularios";

export const metadata: Metadata = { title: "Formularios" };

export default async function FormulariosPage() {
  const ctx = await requerirModulo("tesis", "tesis:editar");
  const lista = await withOrg(ctx.organizacion.id, (tx) => listarFormularios(tx));
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Formularios</h1>
        <Button asChild>
          <Link href="/panel/tesis/formularios/nuevo">Nuevo formulario</Link>
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">Formularios reutilizables para recolectar datos del estudiante. Se eligen en el paso 8 de cada propuesta.</p>
      <Card>
        <CardContent className="divide-y pt-4 md:pt-6">
          {lista.length === 0 && <p className="text-sm text-muted-foreground">Aún no hay formularios.</p>}
          {lista.map((f) => (
            <Link key={f.id} href={`/panel/tesis/formularios/${f.id}`} className="flex justify-between py-3 hover:underline">
              <span className="font-medium">{f.nombre}</span>
              <span className="text-sm text-muted-foreground">{f.campos} campos</span>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
