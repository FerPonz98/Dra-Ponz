"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Aviso } from "@/components/ui/aviso";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Campo, Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

function Formulario() {
  const token = useSearchParams().get("token");
  const [estado, setEstado] = useState<"inicial" | "ok" | "error">("inicial");
  const [mensaje, setMensaje] = useState("");

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const nueva = String(fd.get("nueva") ?? "");
    if (nueva.length < 8) return (setEstado("error"), setMensaje("La contraseña debe tener al menos 8 caracteres."));
    if (nueva !== String(fd.get("repetir"))) return (setEstado("error"), setMensaje("Las contraseñas no coinciden."));
    const r = await authClient.resetPassword({ newPassword: nueva, token: token ?? "" });
    if (r.error) return (setEstado("error"), setMensaje("El enlace no es válido o ya venció."));
    setEstado("ok");
  }

  if (!token) return <Aviso tipo="error">Enlace incompleto. Pide uno nuevo.</Aviso>;
  if (estado === "ok")
    return (
      <Aviso tipo="exito">
        Contraseña actualizada. <Link href="/login" className="underline">Inicia sesión</Link>.
      </Aviso>
    );
  return (
    <form onSubmit={enviar} className="space-y-4">
      {estado === "error" && <Aviso tipo="error">{mensaje}</Aviso>}
      <Campo etiqueta="Nueva contraseña" htmlFor="nueva">
        <Input id="nueva" name="nueva" type="password" autoComplete="new-password" required />
      </Campo>
      <Campo etiqueta="Repite la contraseña" htmlFor="repetir">
        <Input id="repetir" name="repetir" type="password" autoComplete="new-password" required />
      </Campo>
      <Button type="submit" className="w-full">
        Guardar
      </Button>
    </form>
  );
}

export default function RestablecerPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Nueva contraseña</CardTitle>
      </CardHeader>
      <CardContent>
        <Suspense>
          <Formulario />
        </Suspense>
      </CardContent>
    </Card>
  );
}
