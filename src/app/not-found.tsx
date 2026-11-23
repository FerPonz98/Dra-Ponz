import { Compass } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NoEncontrado() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="max-w-md text-center">
        <span className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <Compass className="size-7" aria-hidden />
        </span>
        <p className="text-sm font-semibold text-primary">Error 404</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Página no encontrada</h1>
        <p className="mt-2 text-muted-foreground">El enlace no existe o ya no está disponible.</p>
        <Button asChild variant="outline" className="mt-6">
          <Link href="/">Ir al inicio</Link>
        </Button>
      </div>
    </main>
  );
}
