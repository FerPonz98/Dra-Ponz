"use client";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Aviso } from "@/components/ui/aviso";
import { Button } from "@/components/ui/button";
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
    if (r.error) return (setEstado("error"), setMensaje("El enlace no es válido o ya venció. Pide uno nuevo."));
    setEstado("ok");
  }

  if (!token) return <Aviso tipo="error">El enlace está incompleto. Pide uno nuevo desde «¿Olvidaste tu contraseña?».</Aviso>;
  if (estado === "ok")
    return (
      <div className="space-y-4 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-exito-soft text-exito">
          <CheckCircle2 className="size-6" aria-hidden />
        </span>
        <p className="text-sm">Tu contraseña se actualizó.</p>
        <Button asChild className="w-full">
          <Link href="/login">Iniciar sesión</Link>
        </Button>
      </div>
    );
  return (
    <form onSubmit={enviar} className="space-y-5">
      {estado === "error" && <Aviso tipo="error">{mensaje}</Aviso>}
      <Campo etiqueta="Nueva contraseña" htmlFor="nueva" ayuda="Mínimo 8 caracteres.">
        <Input id="nueva" name="nueva" type="password" autoComplete="new-password" required />
      </Campo>
      <Campo etiqueta="Repite la contraseña" htmlFor="repetir">
        <Input id="repetir" name="repetir" type="password" autoComplete="new-password" required />
      </Campo>
      <Button type="submit" size="lg" className="w-full">
        Guardar contraseña
      </Button>
    </form>
  );
}

export default function RestablecerPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Nueva contraseña</h1>
        <p className="text-sm text-muted-foreground">Elige una contraseña que no uses en otros sitios.</p>
      </div>
      <Suspense>
        <Formulario />
      </Suspense>
    </div>
  );
}
