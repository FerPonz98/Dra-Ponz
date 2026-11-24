import type { Metadata } from "next";
import { FormRecuperar } from "./form-recuperar";

export const metadata: Metadata = { title: "Recuperar contraseña", robots: { index: false } };

export default function RecuperarPage() {
  // Sin Resend ni SMTP el correo solo se guarda en un archivo: se avisa en vez de decir «revisa tu correo».
  return <FormRecuperar correoConfigurado={!!(process.env.RESEND_API_KEY || process.env.SMTP_HOST)} />;
}

export const dynamic = "force-dynamic";
