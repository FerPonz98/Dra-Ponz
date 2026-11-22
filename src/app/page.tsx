import { redirect } from "next/navigation";

// La landing pública vive en /es y /pt (fase 5). Mientras tanto, la raíz lleva al login.
export default function Raiz() {
  redirect("/login");
}
