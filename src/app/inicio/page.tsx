import { redirect } from "next/navigation";
import { requerirSesion } from "@/core/contexto";

export default async function Inicio() {
  const ctx = await requerirSesion();
  redirect(ctx.usuario.esSuperadmin ? "/superadmin" : "/panel");
}
