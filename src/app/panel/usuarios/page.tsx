import type { Metadata } from "next";
import { requerirPermiso } from "@/core/contexto";
import { CATALOGO_PERMISOS } from "@/core/permisos";
import { listarRoles, usuariosDeOrganizacion } from "@/core/servicios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { withOrg } from "@/lib/db";
import { EditorRoles, NuevoUsuario, TablaUsuarios } from "./cliente";

export const metadata: Metadata = { title: "Usuarios y roles" };

export default async function UsuariosPage() {
  const ctx = await requerirPermiso("usuarios:gestionar");
  const [lista, rolesOrg] = await Promise.all([usuariosDeOrganizacion(ctx.organizacion.id), withOrg(ctx.organizacion.id, (tx) => listarRoles(tx))]);
  const permisos = CATALOGO_PERMISOS.filter((p) => p.modulo === null || ctx.modulos.includes(p.modulo)).map((p) => ({ codigo: p.codigo, etiqueta: p.etiqueta }));
  const rolesSimple = rolesOrg.map((r) => ({ id: r.id, nombre: r.nombre, permisos: r.permisos, esAdmin: r.esAdmin }));
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <h1 className="text-2xl font-semibold">Usuarios y roles</h1>
      <Card>
        <CardHeader>
          <CardTitle>Usuarios</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <TablaUsuarios usuarios={lista.map((u) => ({ ...u, yo: u.id === ctx.usuario.id }))} roles={rolesSimple} />
          <NuevoUsuario roles={rolesSimple} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Roles y permisos por módulo</CardTitle>
        </CardHeader>
        <CardContent>
          <EditorRoles key={rolesSimple.map((r) => r.id).join()} roles={rolesSimple} permisos={permisos} />
        </CardContent>
      </Card>
    </div>
  );
}
