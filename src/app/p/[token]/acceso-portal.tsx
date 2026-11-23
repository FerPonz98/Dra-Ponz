"use client";
import { useActionState } from "react";
import { Aviso } from "@/components/ui/aviso";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Campo, Input } from "@/components/ui/input";
import { accionAccederPortal } from "./acciones";

export function AccesoPortal({ token, metodo, organizacion }: { token: string; metodo: "ci" | "pin"; organizacion: string }) {
  const [estado, accion, pendiente] = useActionState(accionAccederPortal.bind(null, token), null);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{organizacion}</CardTitle>
        <CardDescription>Para ver tu plan, ingresa {metodo === "ci" ? "tu número de carnet (CI)" : "el PIN que te enviamos"}.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={accion} className="space-y-4">
          {estado && !estado.ok && <Aviso tipo="error">{estado.mensaje}</Aviso>}
          <Campo etiqueta={metodo === "ci" ? "Carnet de identidad (CI)" : "PIN"} htmlFor="credencial">
            <Input id="credencial" name="credencial" required autoComplete="off" inputMode={metodo === "pin" ? "numeric" : "text"} maxLength={30} />
          </Campo>
          <Button type="submit" className="w-full" disabled={pendiente}>
            Entrar
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
