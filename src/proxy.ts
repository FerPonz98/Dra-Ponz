import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { ipCliente, permitir } from "@/lib/seguridad";

const PROTEGIDAS = /^\/(panel|superadmin|inicio)(\/|$)/;
/** Nonce de marcador de la landing cacheada en Nginx (se reemplaza en cada respuesta; ver scripts/nginx). */
export const NONCE_MARCADOR = "CSPNONCEMARCADOR0000000000000000";

/** Content-Security-Policy estricta con nonce por petición (scripts) — ver docs de Next "Content Security Policy". */
export function politicaCsp(nonce: string, dev = process.env.NODE_ENV === "development") {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    // Estilos en línea: los usan next/font, Radix y los style={} de React. No permiten ejecutar código.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    // Solo con HTTPS (en http://localhost subiría las peticiones a https y nada cargaría).
    ...((process.env.APP_URL ?? "").startsWith("https://") ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

/** Límite general por IP y por minuto (en memoria, por proceso). Reemplaza el limit_req de Nginx (Easypanel usa Traefik). */
function limitePara(ruta: string): { uso: string; max: number } {
  if (ruta.startsWith("/p/")) return { uso: "web-portal", max: 300 };
  if (/^\/(login|recuperar|restablecer)(\/|$)/.test(ruta)) return { uso: "web-acceso", max: 60 };
  return { uso: "web", max: 600 };
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const l = limitePara(pathname);
  if (process.env.LIMITES_DESACTIVADOS !== "1" && !permitir(`${l.uso}:${ipCliente(req.headers)}`, l.max, 60_000)) {
    return new NextResponse("Demasiadas solicitudes seguidas. Espera un minuto e inténtalo de nuevo.", { status: 429, headers: { "Retry-After": "60", "Content-Type": "text/plain; charset=utf-8" } });
  }
  // Chequeo optimista: sin cookie de sesión → /login. La verificación real ocurre en cada página/acción.
  if (PROTEGIDAS.test(pathname) && !getSessionCookie(req, { cookiePrefix: "cobros" })) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  // Landing detrás de la micro-caché de Nginx: se renderiza con un nonce MARCADOR que Nginx reemplaza en cada respuesta
  // por uno aleatorio ($request_id, vía sub_filter) junto con la CSP. Así la landing se cachea sin reusar nonces.
  // Solo con el Nginx del repo (LANDING_CACHE_NGINX=1, app en 127.0.0.1). En Easypanel/Traefik está APAGADO: la landing
  // se renderiza siempre con un nonce aleatorio y no se cachea (la seguridad de la CSP tiene prioridad).
  const marcador = process.env.LANDING_CACHE_NGINX === "1" && req.headers.get("x-landing-cache") === "1" && /^\/(es|pt)\/?$/.test(pathname);
  const nonce = marcador ? NONCE_MARCADOR : Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = politicaCsp(nonce);
  const cabeceras = new Headers(req.headers);
  cabeceras.set("x-nonce", nonce);
  cabeceras.set("Content-Security-Policy", csp);
  const res = NextResponse.next({ request: { headers: cabeceras } });
  res.headers.set("Content-Security-Policy", csp);
  if (req.headers.get("x-forwarded-proto") === "https") res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  return res;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|marca/|brand/|_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|manifest.webmanifest|robots.txt|sitemap.xml|landing/).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
