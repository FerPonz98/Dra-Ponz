import { defineConfig, devices } from "@playwright/test";

const PUERTO = Number(process.env.E2E_PORT ?? 3100);
const URL_BASE = `http://localhost:${PUERTO}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  globalSetup: "./tests/e2e/preparar.ts",
  use: { baseURL: URL_BASE, trace: "retain-on-failure", locale: "es-BO", timezoneId: "America/La_Paz" },
  projects: [
    { name: "escritorio", use: { ...devices["Desktop Chrome"] } },
    { name: "celular", use: { ...devices["Pixel 7"], viewport: { width: 375, height: 800 } }, grep: /@movil/ },
  ],
  webServer: {
    command: `npm run start -- -p ${PUERTO}`,
    url: `${URL_BASE}/login`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { BETTER_AUTH_URL: URL_BASE, APP_URL: URL_BASE, NODE_ENV: "production", LOGIN_MAX_POR_MINUTO: "1000" },
  },
});
