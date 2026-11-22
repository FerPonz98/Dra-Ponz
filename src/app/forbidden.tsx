import Link from "next/link";

export default function Prohibido() {
  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold">Acceso no permitido</h1>
      <p className="mt-2 text-muted-foreground">No tienes permiso para ver esta página o el módulo no está activo.</p>
      <Link href="/inicio" className="mt-6 inline-block text-primary underline">
        Volver al inicio
      </Link>
    </main>
  );
}
