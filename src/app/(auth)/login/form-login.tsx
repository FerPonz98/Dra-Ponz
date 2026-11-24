"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, LogIn } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Aviso } from "@/components/ui/aviso";
import { Button } from "@/components/ui/button";
import { Campo, Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

const esquema = z.object({
  correo: z.email("Escribe un correo válido"),
  contrasena: z.string().min(1, "Escribe tu contraseña"),
});
type Datos = z.infer<typeof esquema>;

export function FormLogin() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [ver, setVer] = useState(false);
  const { register, handleSubmit, formState } = useForm<Datos>({ resolver: zodResolver(esquema) });

  async function enviar(d: Datos) {
    setError(null);
    const r = await authClient.signIn.email({ email: d.correo, password: d.contrasena });
    if (r.error) {
      setError(r.error.status === 429 ? "Demasiados intentos. Espera unos minutos e inténtalo de nuevo." : "Correo o contraseña incorrectos.");
      return;
    }
    router.replace("/inicio");
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm lg:hidden" aria-hidden>
          <LogIn className="size-5" />
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">Te damos la bienvenida</h1>
        <p className="text-sm text-muted-foreground">Ingresa con tu correo y contraseña.</p>
      </div>
      <form method="post" onSubmit={handleSubmit(enviar)} className="space-y-5" noValidate>
        {error && <Aviso tipo="error">{error}</Aviso>}
        <Campo etiqueta="Correo" htmlFor="correo" error={formState.errors.correo?.message}>
          <Input id="correo" type="email" autoComplete="email" autoFocus aria-invalid={!!formState.errors.correo} {...register("correo")} />
        </Campo>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="contrasena" className="text-sm font-medium">
              Contraseña
            </label>
            <Link href="/recuperar" className="text-xs font-medium text-primary hover:underline">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          <div className="relative">
            <Input id="contrasena" type={ver ? "text" : "password"} autoComplete="current-password" className="pr-10" aria-invalid={!!formState.errors.contrasena} {...register("contrasena")} />
            <button type="button" onClick={() => setVer(!ver)} className="absolute right-1 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-subtle-foreground hover:text-foreground" aria-label={ver ? "Ocultar" : "Mostrar"} aria-controls="contrasena" aria-pressed={ver}>
              {ver ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {formState.errors.contrasena && <p className="text-xs font-medium text-peligro">{formState.errors.contrasena.message}</p>}
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? "Ingresando…" : "Ingresar"}
        </Button>
      </form>
    </div>
  );
}
