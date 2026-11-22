import { requerirOrganizacion } from "@/core/contexto";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function PanelPage() {
  const ctx = await requerirOrganizacion();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Hola, {ctx.usuario.nombre}</h1>
      <Card>
        <CardHeader>
          <CardTitle>{ctx.organizacion.nombre}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Módulos activos: {ctx.modulos.join(", ") || "ninguno"}</p>
        </CardContent>
      </Card>
    </div>
  );
}
