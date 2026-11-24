// HEALTHCHECK del contenedor. Servicio App: /api/health responde 200 (app + base de datos).
// Servicio Worker (sin servidor web): su latido tiene menos de 2 minutos.
import { existsSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const latido = join(tmpdir(), "worker-latido");
if (existsSync(latido)) {
  process.exit(Date.now() - statSync(latido).mtimeMs < 120_000 ? 0 : 1);
}
fetch(`http://127.0.0.1:${process.env.PORT ?? 3000}/api/health`, { signal: AbortSignal.timeout(5000) })
  .then((r) => process.exit(r.ok ? 0 : 1))
  .catch(() => process.exit(1));
