"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Aviso } from "@/components/ui/aviso";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Campo, Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

const esquema = z.object({
  correo: z.email("Correo no válido"),
  contrasena: z.string().min(1, "Escribe tu contraseña"),
});
type Datos = z.infer<typeof esquema>;

export function FormLogin() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<Datos>({ resolver: zodResolver(esquema) });

  async function enviar(d: Datos) {
    setError(null);
    const r = await authClient.signIn.email({ email: d.correo, password: d.contrasena });
    if (r.error) {
      setError(r.error.status === 429 ? "Demasiados intentos. Espera un minuto." : "Correo o contraseña incorrectos.");
      return;
    }
    router.replace("/inicio");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Iniciar sesión</CardTitle>
        <CardDescription>Ingresa con tu correo y contraseña.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(enviar)} className="space-y-4" noValidate>
          {error && <Aviso tipo="error">{error}</Aviso>}
          <Campo etiqueta="Correo" htmlFor="correo" error={formState.errors.correo?.message}>
            <Input id="correo" type="email" autoComplete="email" {...register("correo")} />
          </Campo>
          <Campo etiqueta="Contraseña" htmlFor="contrasena" error={formState.errors.contrasena?.message}>
            <Input id="contrasena" type="password" autoComplete="current-password" {...register("contrasena")} />
          </Campo>
          <Button type="submit" className="w-full" disabled={formState.isSubmitting}>
            {formState.isSubmitting ? "Ingresando…" : "Ingresar"}
          </Button>
          <p className="text-center text-sm">
            <Link href="/recuperar" className="text-primary underline-offset-4 hover:underline">
              ¿Olvidaste tu contraseña?
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
