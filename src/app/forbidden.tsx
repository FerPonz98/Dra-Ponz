import { ShieldX } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Prohibido() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="max-w-md text-center">
        <span className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-peligro-soft text-peligro">
          <ShieldX className="size-7" aria-hidden />
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">Acceso no permitido</h1>
        <p className="mt-2 text-muted-foreground">No tienes permiso para ver esta página o el módulo no está activo en tu organización.</p>
        <Button asChild className="mt-6">
          <Link href="/inicio">Volver al inicio</Link>
        </Button>
      </div>
    </main>
  );
}
