import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type Correo = { para: string; asunto: string; html: string; texto?: string };

/**
 * Envía con Resend si hay RESEND_API_KEY, con SMTP si hay SMTP_HOST; si no, guarda el correo
 * como JSON en ./.data/correos (desarrollo y pruebas).
 */
export async function enviarCorreo(c: Correo): Promise<{ via: "resend" | "smtp" | "archivo" }> {
  const remitente = process.env.CORREO_REMITENTE ?? "Cobros <no-responder@localhost>";
  if (process.env.RESEND_API_KEY) {
    const { Resend } = await import("resend");
    const r = await new Resend(process.env.RESEND_API_KEY).emails.send({ from: remitente, to: c.para, subject: c.asunto, html: c.html, text: c.texto });
    if (r.error) throw new Error(`Resend: ${r.error.message}`);
    return { via: "resend" };
  }
  if (process.env.SMTP_HOST) {
    const nodemailer = await import("nodemailer");
    const t = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
    await t.sendMail({ from: remitente, to: c.para, subject: c.asunto, html: c.html, text: c.texto });
    return { via: "smtp" };
  }
  const dir = join(/*turbopackIgnore: true*/ process.cwd(), ".data", "correos");
  await mkdir(dir, { recursive: true });
  const nombre = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${c.para.replace(/[^a-z0-9@.]/gi, "_")}.json`;
  await writeFile(join(dir, nombre), JSON.stringify({ ...c, fecha: new Date().toISOString() }, null, 2));
  console.info(`[correo] guardado en .data/correos/${nombre} → ${c.para}: ${c.asunto}`);
  return { via: "archivo" };
}
