import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { obtenerContexto } from "@/core/contexto";
import { FormLogin } from "./form-login";

export const metadata: Metadata = { title: "Iniciar sesión", robots: { index: false } };

export default async function LoginPage() {
  const ctx = await obtenerContexto();
  if (ctx) redirect(ctx.usuario.esSuperadmin ? "/superadmin" : "/panel");
  return <FormLogin />;
}
