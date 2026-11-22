import Link from "next/link";

export default function NoEncontrado() {
  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold">Página no encontrada</h1>
      <p className="mt-2 text-muted-foreground">El enlace no existe o ya no está disponible.</p>
      <Link href="/" className="mt-6 inline-block text-primary underline">
        Ir al inicio
      </Link>
    </main>
  );
}
