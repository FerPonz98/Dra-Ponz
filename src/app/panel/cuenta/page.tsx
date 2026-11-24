import type { Metadata } from "next";
import { requerirOrganizacion } from "@/core/contexto";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EncabezadoPagina } from "@/components/ui/varios";
import { FormCambiarClave } from "./form-cambiar-clave";

export const metadata: Metadata = { title: "Mi cuenta" };

export default async function CuentaPage() {
  const ctx = await requerirOrganizacion();
  return (
    <div className="mx-auto max-w-2xl">
      <EncabezadoPagina ayuda="contrasena" titulo="Mi cuenta" descripcion={`${ctx.usuario.nombre} · ${ctx.usuario.correo}`} />
      <Card>
        <CardHeader>
          <CardTitle>Cambiar contraseña</CardTitle>
          <CardDescription>Escribe tu contraseña actual y la nueva. Se cerrará la sesión en tus otros dispositivos.</CardDescription>
        </CardHeader>
        <CardContent>
          <FormCambiarClave />
        </CardContent>
      </Card>
    </div>
  );
}
