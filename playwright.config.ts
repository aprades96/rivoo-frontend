import { defineConfig, devices } from "@playwright/test"

/**
 * Playwright solo para la comparacion visual contra los artboards de `design/`.
 *
 * Usa el Chrome ya instalado en la maquina (`channel: "chrome"`) en vez del
 * navegador propio de Playwright: evita una descarga de ~150 MB que ademas
 * saldria de un CDN externo, mientras que el registro npm de este equipo apunta
 * a un Nexus interno. Si algun dia esto corre en CI, habra que quitar el
 * `channel` y hacer `npx playwright install chromium`.
 *
 * NO forma parte de `npm run test` (Vitest). Se lanza a mano:
 *   npx playwright test --config=playwright.config.ts
 * y necesita la pila levantada (Keycloak + gateway + servicios + `npm run dev`).
 */
export default defineConfig({
  testDir: "./visual",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.RIVOO_BASE_URL ?? "http://localhost:3000",
    ...devices["Desktop Chrome"],
    channel: "chrome",
    screenshot: "off",
    trace: "off",
  },
})
