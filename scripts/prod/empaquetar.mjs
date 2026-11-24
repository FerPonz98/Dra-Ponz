// npm run build:prod → dist-prod/*.mjs: scripts de producción en un solo archivo cada uno (sin TypeScript ni tsx en la
// imagen). Resuelve los alias "@/…" del tsconfig. Lo corre el Dockerfile después de `next build`.
import { build } from "esbuild";

await build({
  entryPoints: { migrar: "scripts/prod/migrar.ts", worker: "scripts/prod/worker.ts", "seed-prod": "scripts/prod/seed-prod.ts", restaurar: "scripts/prod/restaurar.ts", salud: "scripts/prod/salud.ts", "restablecer-clave": "scripts/prod/restablecer-clave.ts" },
  outdir: "dist-prod",
  outExtension: { ".js": ".mjs" },
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  sourcemap: true,
  legalComments: "none",
  alias: { "server-only": "./scripts/prod/vacio.ts" },
  external: ["pg-native"],
  // Paquetes CommonJS dentro de un módulo ES
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  logLevel: "warning",
});
console.log("✓ dist-prod listo");
