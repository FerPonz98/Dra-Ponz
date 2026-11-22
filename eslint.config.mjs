import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Regla de módulos (no negociable): cobros nunca importa de tesis.
  {
    files: ["src/modules/cobros/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/modules/tesis", "@/modules/tesis/*", "**/modules/tesis", "**/modules/tesis/*", "../tesis", "../tesis/*", "../../tesis/*", "../../../tesis/*"],
              message: "El módulo cobros no puede importar del módulo tesis (tesis → cobros sí; cobros → tesis nunca).",
            },
          ],
        },
      ],
    },
  },
  // El núcleo no depende de ningún módulo de negocio.
  {
    files: ["src/core/**/*.{ts,tsx}", "src/lib/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/modules/*", "**/modules/*"],
              message: "core y lib no pueden importar módulos de negocio.",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "drizzle/**", "test-results/**", "playwright-report/**", "lighthouse/**"]),
]);

export default eslintConfig;
