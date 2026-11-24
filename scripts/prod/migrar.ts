// Punto de entrada: node dist-prod/migrar.mjs (docker-entrypoint.sh, antes de arrancar la app o el worker).
import { migrarProduccion } from "./migraciones";

migrarProduccion().catch((e) => {
  console.error(`✗ ${(e as Error).message}`);
  process.exit(1);
});
