import { headers } from "next/headers";
import { redirect } from "next/navigation";

// La raíz lleva a la landing en el idioma del navegador (portugués si lo prefiere; si no, español).
export default async function Raiz() {
  const idioma = (await headers()).get("accept-language") ?? "";
  redirect(/^pt\b/i.test(idioma.trim()) ? "/pt" : "/es");
}
