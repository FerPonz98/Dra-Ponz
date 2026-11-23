"use client";
import { ShieldCheck } from "lucide-react";
import { useActionState } from "react";
import { Aviso } from "@/components/ui/aviso";
import { Button } from "@/components/ui/button";
import { Campo, Input } from "@/components/ui/input";
import { accionAccederPortal } from "./acciones";

export function AccesoPortal({ token, metodo, organizacion }: { token: string; metodo: "ci" | "pin"; organizacion: string }) {
  const [estado, accion, pendiente] = useActionState(accionAccederPortal.bind(null, token), null);
  return (
    <section className="rounded-3xl border border-border bg-surface p-6 shadow-sm sm:p-8">
      <span className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        <ShieldCheck className="size-6" aria-hidden />
      </span>
      <h1 className="text-2xl font-semibold tracking-tight">¡Hola! Qué bueno verte</h1>
      <p className="mt-2 text-muted-foreground">
        Para ver tu plan con <strong className="font-medium text-foreground">{organizacion}</strong>, confirma que eres tú con {metodo === "ci" ? "tu número de carnet (CI)" : "el PIN que te enviamos"}.
      </p>
      <form action={accion} className="mt-6 space-y-5">
        {estado && !estado.ok && <Aviso tipo="error">{estado.mensaje}</Aviso>}
        <Campo etiqueta={metodo === "ci" ? "Carnet de identidad (CI)" : "PIN"} htmlFor="credencial" ayuda={metodo === "ci" ? "Solo números y letras, sin espacios." : "Son 6 números."}>
          <Input id="credencial" name="credencial" required autoComplete="off" inputMode={metodo === "pin" ? "numeric" : "text"} maxLength={30} className="h-12 text-lg" autoFocus />
        </Campo>
        <Button type="submit" size="lg" className="h-12 w-full rounded-xl text-base" disabled={pendiente}>
          {pendiente ? "Verificando…" : "Entrar"}
        </Button>
      </form>
    </section>
  );
}
