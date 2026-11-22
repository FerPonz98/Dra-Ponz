import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { dbAdmin } from "@/lib/db";
import { cuentas, sesiones, usuarios, verificaciones } from "@/core/db/schema";
import { enviarCorreo } from "@/lib/correo";

function crearAuth() {
  return betterAuth({
    appName: "Cobros",
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL ?? process.env.APP_URL,
    database: drizzleAdapter(dbAdmin(), {
      provider: "pg",
      schema: { usuarios, sesiones, cuentas, verificaciones },
    }),
    user: {
      modelName: "usuarios",
      additionalFields: {
        organizacionId: { type: "string", required: false, input: false },
        rolId: { type: "string", required: false, input: false },
        esSuperadmin: { type: "boolean", required: false, input: false, defaultValue: false },
        activo: { type: "boolean", required: false, input: false, defaultValue: true },
      },
    },
    session: { modelName: "sesiones", expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
    account: { modelName: "cuentas" },
    verification: { modelName: "verificaciones" },
    emailAndPassword: {
      enabled: true,
      disableSignUp: true, // las cuentas las crea el superadmin o el admin de la organización
      minPasswordLength: 8,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: 60 * 60,
      sendResetPassword: async ({ user, url }) => {
        await enviarCorreo({
          para: user.email,
          asunto: "Restablece tu contraseña",
          html: `<p>Hola ${escapar(user.name)},</p><p>Para crear una nueva contraseña abre este enlace (vence en 1 hora):</p><p><a href="${url}">${url}</a></p><p>Si no lo pediste, ignora este correo.</p>`,
          texto: `Restablece tu contraseña: ${url}`,
        });
      },
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
      customRules: { "/sign-in/email": { window: 60, max: 10 }, "/request-password-reset": { window: 60, max: 5 } },
    },
    advanced: {
      database: { generateId: () => crypto.randomUUID() },
      cookiePrefix: "cobros",
    },
    plugins: [nextCookies()],
  });
}

type Auth = ReturnType<typeof crearAuth>;
const g = globalThis as typeof globalThis & { __auth?: Auth };
export function auth(): Auth {
  g.__auth ??= crearAuth();
  return g.__auth;
}

function escapar(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
