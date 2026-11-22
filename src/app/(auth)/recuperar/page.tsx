"use client";
import Link from "next/link";
import { useState } from "react";
import { Aviso } from "@/components/ui/aviso";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Campo, Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

export default function RecuperarPage() {
  const [enviado, setEnviado] = useState(false);
  const [cargando, setCargando] = useState(false);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCargando(true);
    const correo = String(new FormData(e.currentTarget).get("correo") ?? "");
    await authClient.requestPasswordReset({ email: correo, redirectTo: "/restablecer" });
    setCargando(false);
    setEnviado(true); // siempre el mismo mensaje: no revela si la cuenta existe
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recuperar contraseña</CardTitle>
        <CardDescription>Te enviaremos un enlace a tu correo.</CardDescription>
      </CardHeader>
      <CardContent>
        {enviado ? (
          <Aviso tipo="exito">Si el correo está registrado, recibirás un enlace para crear una nueva contraseña.</Aviso>
        ) : (
          <form onSubmit={enviar} className="space-y-4">
            <Campo etiqueta="Correo" htmlFor="correo">
              <Input id="correo" name="correo" type="email" required autoComplete="email" />
            </Campo>
            <Button type="submit" className="w-full" disabled={cargando}>
              Enviar enlace
            </Button>
          </form>
        )}
        <p className="mt-4 text-center text-sm">
          <Link href="/login" className="text-primary hover:underline">
            Volver a iniciar sesión
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
