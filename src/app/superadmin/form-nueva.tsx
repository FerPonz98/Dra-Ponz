"use client";
import { useActionState } from "react";
import { Aviso } from "@/components/ui/aviso";
import { Button } from "@/components/ui/button";
import { Campo, Input, Select } from "@/components/ui/input";
import { accionCrearOrganizacion } from "./acciones";

export function FormNuevaOrganizacion() {
  const [estado, accion, pendiente] = useActionState(accionCrearOrganizacion, null);
  return (
    <form action={accion} className="grid gap-4 md:grid-cols-2">
      {estado && (
        <div className="md:col-span-2">
          <Aviso tipo={estado.ok ? "exito" : "error"}>{estado.mensaje}</Aviso>
        </div>
      )}
      <Campo etiqueta="Nombre" htmlFor="nombre">
        <Input id="nombre" name="nombre" required />
      </Campo>
      <Campo etiqueta="Identificador (slug)" htmlFor="slug" ayuda="Minúsculas y guiones, ej. clinica-sonrisa">
        <Input id="slug" name="slug" required pattern="[a-z0-9][a-z0-9-]{1,60}" />
      </Campo>
      <Campo etiqueta="Moneda por defecto" htmlFor="monedaDefecto">
        <Select id="monedaDefecto" name="monedaDefecto" defaultValue="BOB">
          <option value="BOB">Bolivianos (BOB)</option>
          <option value="BRL">Reales (BRL)</option>
        </Select>
      </Campo>
      <Campo etiqueta="Dominio (opcional)" htmlFor="dominio">
        <Input id="dominio" name="dominio" placeholder="ejemplo.com" />
      </Campo>
      <fieldset className="md:col-span-2">
        <legend className="text-sm font-medium">Módulos</legend>
        <div className="mt-2 flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="modulos" value="cobros" defaultChecked /> Cobros
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="modulos" value="tesis" /> Tesis
          </label>
        </div>
      </fieldset>
      <Campo etiqueta="Nombre del administrador" htmlFor="adminNombre">
        <Input id="adminNombre" name="adminNombre" required />
      </Campo>
      <Campo etiqueta="Correo del administrador" htmlFor="adminCorreo">
        <Input id="adminCorreo" name="adminCorreo" type="email" required />
      </Campo>
      <Campo etiqueta="Contraseña inicial" htmlFor="adminContrasena" ayuda="Mínimo 8 caracteres">
        <Input id="adminContrasena" name="adminContrasena" type="password" minLength={8} required />
      </Campo>
      <div className="flex items-end">
        <Button type="submit" disabled={pendiente}>
          Crear organización
        </Button>
      </div>
    </form>
  );
}
