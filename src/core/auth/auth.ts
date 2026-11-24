import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware, isAPIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { dbAdmin } from "@/lib/db";
import { cuentas, limitesAuth, sesiones, usuarios, verificaciones } from "@/core/db/schema";
import { estaBloqueadaCuenta, registrarIntentoLogin } from "@/core/auth/bloqueo";
import { logoParaCorreo } from "@/core/marca/servidor";
import { enviarCorreo } from "@/lib/correo";

function crearAuth() {
  return betterAuth({
    appName: "Cobros",
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL ?? process.env.APP_URL,
    database: drizzleAdapter(dbAdmin(), {
      provider: "pg",
      schema: { usuarios, sesiones, cuentas, verificaciones, limitesAuth },
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
        const orgId = (user as { organizacionId?: string | null }).organizacionId;
        const logo = orgId ? await logoParaCorreo(orgId).catch(() => null) : null;
        await enviarCorreo({
          para: user.email,
          asunto: "Restablece tu contraseña",
          html: `${logo ? `<p><img src="${logo.url}" alt="${escapar(logo.alt)}" width="240" style="display:block;max-width:240px;height:auto;border:0"></p>` : ""}<p>Hola ${escapar(user.name)},</p><p>Para crear una nueva contraseña abre este enlace (vence en 1 hora):</p><p><a href="${url}">${url}</a></p><p>Si no lo pediste, ignora este correo.</p>`,
          texto: `Restablece tu contraseña: ${url}`,
        });
      },
    },
    rateLimit: {
      enabled: true,
      // En la BD (no en memoria): lo comparten todos los procesos de PM2 y no se reinicia con un deploy.
      storage: "database",
      modelName: "limitesAuth",
      window: 60,
      max: 100,
      customRules: { "/sign-in/email": { window: 60, max: Number(process.env.LOGIN_MAX_POR_MINUTO ?? 10) }, "/request-password-reset": { window: 60, max: 5 } },
    },
    hooks: {
      // Bloqueo por cuenta (además del límite por IP): 10 fallos con el mismo correo → 15 minutos, desde cualquier IP.
      // Se aplica a cualquier correo (exista o no), así no revela qué cuentas existen.
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/sign-in/email") return;
        const correo = String((ctx.body as { email?: unknown } | undefined)?.email ?? "");
        if (await estaBloqueadaCuenta(correo)) throw new APIError("TOO_MANY_REQUESTS", { message: "Demasiados intentos. Inténtalo de nuevo en unos minutos." });
      }),
      after: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/sign-in/email") return;
        const correo = String((ctx.body as { email?: unknown } | undefined)?.email ?? "");
        const r = ctx.context.returned;
        if (isAPIError(r) && r.statusCode === 401) await registrarIntentoLogin(correo, false);
        else if (!isAPIError(r)) await registrarIntentoLogin(correo, true);
      }),
    },
    advanced: {
      // Detrás de Nginx: la IP real es el último salto que no es el proxy local (X-Forwarded-For no es falsificable así).
      ipAddress: { ipAddressHeaders: ["x-forwarded-for"], trustedProxies: ["127.0.0.1", "::1"] },
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
