// Utilidades de seguridad para rutas y acciones: IP del cliente, límite de peticiones y mismo origen.
// El límite es en memoria (por proceso): es una segunda barrera. La primera es `limit_req` de Nginx
// (scripts/nginx), y los bloqueos que importan de verdad (CI/PIN del portal, login por cuenta) están en la BD.

const PROXIES_CONFIABLES = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

/** IP del cliente detrás de Nginx: el último salto de X-Forwarded-For que no es el proxy local. */
export function ipCliente(h: Headers): string {
  const saltos = (h.get("x-forwarded-for") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  for (let i = saltos.length - 1; i >= 0; i--) if (!PROXIES_CONFIABLES.has(saltos[i])) return saltos[i].slice(0, 64);
  return h.get("x-real-ip")?.slice(0, 64) || saltos[0] || "local";
}

type Ventana = { inicio: number; conteo: number };
const g = globalThis as typeof globalThis & { __limites?: Map<string, Ventana> };
const limites = (g.__limites ??= new Map());

/** Ventana fija: `max` peticiones por `ventanaMs` por clave. Devuelve true si se permite. */
export function permitir(clave: string, max: number, ventanaMs: number, ahora = Date.now()): boolean {
  if (limites.size > 50_000) for (const [k, v] of limites) if (ahora - v.inicio > ventanaMs) limites.delete(k);
  const v = limites.get(clave);
  if (!v || ahora - v.inicio > ventanaMs) {
    limites.set(clave, { inicio: ahora, conteo: 1 });
    return true;
  }
  v.conteo++;
  return v.conteo <= max;
}

export class DemasiadasPeticiones extends Error {
  constructor() {
    super("Demasiadas solicitudes seguidas. Espera un minuto e inténtalo de nuevo.");
  }
}

/** Lanza DemasiadasPeticiones si la IP superó el límite para ese uso. */
export function exigirLimite(h: Headers, uso: string, max: number, ventanaMs = 60_000) {
  if (process.env.LIMITES_DESACTIVADOS === "1") return; // solo pruebas de carga/E2E en local
  if (!permitir(`${uso}:${ipCliente(h)}`, max, ventanaMs)) throw new DemasiadasPeticiones();
}

/**
 * Defensa CSRF para rutas POST propias (las server actions ya comparan Origin y Host en Next):
 * el navegador siempre manda Origin en POST; si viene, debe ser este mismo sitio.
 */
export function exigirMismoOrigen(req: Request) {
  const origen = req.headers.get("origin");
  if (!origen) return;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let hostOrigen = "";
  try {
    hostOrigen = new URL(origen).hostname;
  } catch {
    /* origen inválido */
  }
  // Se compara el nombre sin puerto: detrás de Nginx, Host llega como $host (sin puerto).
  const nombreHost = host?.replace(/:\d+$/, "").replace(/^\[|\]$/g, "");
  if (!nombreHost || hostOrigen !== nombreHost) throw new OrigenNoPermitido();
}

export class OrigenNoPermitido extends Error {
  constructor() {
    super("Origen no permitido.");
  }
}
