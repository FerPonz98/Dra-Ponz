import { timingSafeEqual } from "node:crypto";

/** Valida `Authorization: Bearer <CRON_SECRET>` en tiempo constante. */
export function autorizadoCron(req: Request): boolean {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || secreto.length < 16) return false;
  const h = req.headers.get("authorization") ?? "";
  const dado = Buffer.from(h.replace(/^Bearer\s+/i, ""));
  const esperado = Buffer.from(secreto);
  return dado.length === esperado.length && timingSafeEqual(dado, esperado);
}
