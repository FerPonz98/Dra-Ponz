// Validación de las variables de entorno al arrancar (app y worker). Falla con un mensaje claro que dice
// QUÉ variable falta o está mal, en vez de errores raros más tarde. Ver .env.example y DEPLOY_EASYPANEL.md.
import { isAbsolute } from "node:path";
import { z } from "zod";

const urlPg = z.string().regex(/^postgres(ql)?:\/\/[^@]+@[^/]+\/[^/?]+/, "debe ser postgres://usuario:clave@host:puerto/base");
const urlHttp = z.url({ protocol: /^https?$/, message: "debe ser una URL http(s)://…" });

const base = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: urlPg.describe("conexión con el rol de la APP (sujeto a RLS)"),
  // Rol dueño (migraciones, autenticación, jobs). DATABASE_ADMIN_URL es el nombre anterior y se acepta igual.
  DATABASE_URL_OWNER: urlPg.optional(),
  DATABASE_ADMIN_URL: urlPg.optional(),
  BETTER_AUTH_SECRET: z.string().min(32, "debe tener al menos 32 caracteres (openssl rand -base64 32)"),
  BETTER_AUTH_URL: urlHttp,
  APP_URL: urlHttp,
  UPLOAD_DIR: z.string().min(1).default("./.data/uploads"),
  RESEND_API_KEY: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  CORREO_REMITENTE: z.string().optional(),
  CRON_SECRET: z.string().min(24, "si se define, al menos 24 caracteres").optional().or(z.literal("")),
  TZ: z.string().optional(),
});

const worker = base.extend({
  BACKUP_ENCRYPTION_KEY: z.string().min(32, "obligatoria para los backups: al menos 32 caracteres (openssl rand -base64 32)"),
  BACKUP_DIR: z.string().default("/data/backups"),
  BACKUP_DIAS: z.coerce.number().int().min(1).max(365).default(14),
  RCLONE_REMOTE: z.string().optional(),
});

export type Entorno = z.infer<typeof base>;

/**
 * Valida process.env. `uso`: "app" (servidor web) o "worker" (crons y backups).
 * En el contenedor (EN_CONTENEDOR=1) UPLOAD_DIR debe ser absoluta (/data/uploads, el Volume Mount).
 */
export function validarEntorno(uso: "app" | "worker" = "app") {
  const r = (uso === "worker" ? worker : base)
    .superRefine((e, ctx) => {
      if (!e.DATABASE_URL_OWNER && !e.DATABASE_ADMIN_URL) ctx.addIssue({ code: "custom", path: ["DATABASE_URL_OWNER"], message: "falta (conexión con el rol dueño, para migraciones y autenticación)" });
      if (process.env.EN_CONTENEDOR === "1" && !isAbsolute(e.UPLOAD_DIR)) ctx.addIssue({ code: "custom", path: ["UPLOAD_DIR"], message: "debe ser una ruta absoluta (p. ej. /data/uploads, el Volume Mount)" });
      if (e.NODE_ENV === "production" && !e.RESEND_API_KEY && !e.SMTP_HOST) console.warn("⚠ Sin RESEND_API_KEY ni SMTP_HOST: los correos se guardan en archivos y NO se envían.");
    })
    .safeParse(process.env);
  if (!r.success) {
    const lista = r.error.issues.map((i) => `  - ${i.path.join(".") || "(entorno)"}: ${/received undefined/.test(i.message) ? "falta (obligatoria)" : i.message}`).join("\n");
    throw new Error(`Variables de entorno inválidas (${uso}):\n${lista}\nRevisa .env.example o la guía DEPLOY_EASYPANEL.md.`);
  }
  return r.data;
}
