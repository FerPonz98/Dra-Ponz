"use client";
import { useState } from "react";
import { Aviso } from "@/components/ui/aviso";
import { Button } from "@/components/ui/button";
import { Campo, Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

/** Cambiar la contraseña con la sesión iniciada (no depende del correo). Lo valida Better Auth en el servidor. */
export function FormCambiarClave() {
  const [estado, setEstado] = useState<{ ok: boolean; mensaje: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = e.currentTarget;
    const fd = new FormData(f);
    const actual = String(fd.get("actual") ?? "");
    const nueva = String(fd.get("nueva") ?? "");
    if (nueva.length < 8) return setEstado({ ok: false, mensaje: "La nueva contraseña debe tener al menos 8 caracteres." });
    if (nueva !== String(fd.get("repetir"))) return setEstado({ ok: false, mensaje: "Las contraseñas nuevas no coinciden." });
    if (nueva === actual) return setEstado({ ok: false, mensaje: "La nueva contraseña debe ser distinta de la actual." });
    setOcupado(true);
    const r = await authClient.changePassword({ currentPassword: actual, newPassword: nueva, revokeOtherSessions: true });
    setOcupado(false);
    if (r.error) return setEstado({ ok: false, mensaje: r.error.status === 429 ? "Demasiados intentos. Espera unos minutos." : "La contraseña actual no es correcta." });
    f.reset();
    setEstado({ ok: true, mensaje: "Listo: tu contraseña cambió. Úsala la próxima vez que entres." });
  }

  return (
    <form method="post" onSubmit={enviar} className="space-y-4" noValidate>
      {estado && <Aviso tipo={estado.ok ? "exito" : "error"}>{estado.mensaje}</Aviso>}
      <Campo etiqueta="Contraseña actual" htmlFor="clave-actual">
        <Input id="clave-actual" name="actual" type="password" autoComplete="current-password" required />
      </Campo>
      <Campo etiqueta="Nueva contraseña" htmlFor="clave-nueva" ayuda="Mínimo 8 caracteres. Mejor si es larga y no la usas en otro lugar.">
        <Input id="clave-nueva" name="nueva" type="password" autoComplete="new-password" required minLength={8} />
      </Campo>
      <Campo etiqueta="Repite la nueva contraseña" htmlFor="clave-repetir">
        <Input id="clave-repetir" name="repetir" type="password" autoComplete="new-password" required />
      </Campo>
      <Button type="submit" disabled={ocupado}>
        {ocupado ? "Guardando…" : "Cambiar contraseña"}
      </Button>
    </form>
  );
}
