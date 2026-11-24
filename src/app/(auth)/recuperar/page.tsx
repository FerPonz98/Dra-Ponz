"use client";
import { ArrowLeft, MailCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
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
    <div className="space-y-8">
      {enviado ? (
        <div className="space-y-3 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-exito-soft text-exito">
            <MailCheck className="size-6" aria-hidden />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">Revisa tu correo</h1>
          <p className="text-sm text-muted-foreground">Si el correo está registrado, te llegará un enlace para crear una nueva contraseña. Vence en 1 hora.</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">Recuperar contraseña</h1>
            <p className="text-sm text-muted-foreground">Escribe tu correo y te enviaremos un enlace para crear una nueva.</p>
          </div>
          <form method="post" onSubmit={enviar} className="space-y-5">
            <Campo etiqueta="Correo" htmlFor="correo">
              <Input id="correo" name="correo" type="email" required autoComplete="email" autoFocus />
            </Campo>
            <Button type="submit" size="lg" className="w-full" disabled={cargando}>
              {cargando ? "Enviando…" : "Enviar enlace"}
            </Button>
          </form>
        </>
      )}
      <Link href="/login" className="flex items-center justify-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Volver a iniciar sesión
      </Link>
    </div>
  );
}
