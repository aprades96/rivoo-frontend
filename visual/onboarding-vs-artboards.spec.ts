import { test, expect } from "@playwright/test"
import path from "node:path"
import fs from "node:fs"

/**
 * Captura, al mismo viewport, el artboard del diseno y la pantalla construida,
 * para los cinco pasos del asistente de alta, en movil y en escritorio.
 *
 * No compara pixeles automaticamente a proposito: un umbral numerico sobre dos
 * imagenes que no son el mismo render (fuentes distintas, antialiasing distinto)
 * da falsos rojos y falsos verdes por igual. Lo que produce es el par de
 * imagenes para que las mire una persona, que es lo que faltaba por hacer.
 *
 * Requisitos: la pila levantada (Keycloak, gateway, auth/salon/staff/billing) y
 * `npm run dev`. El salon del usuario de prueba debe tener
 * `onboarding_completed_at = NULL`, o el portero no dejara ver el asistente.
 *
 * Variables: RIVOO_E2E_EMAIL, RIVOO_E2E_PASSWORD.
 */

const OUT = path.resolve(
  "../rivoo/docs/specs/onboarding-reanudable/verificacion"
)

const MOBILE = { width: 390, height: 844 }
const DESKTOP = { width: 1440, height: 900 }

/**
 * `ancla` es contenido que solo existe cuando la pantalla ya tiene sus datos.
 * NO vale esperar "Paso N de 5": lo pinta el chasis en el primer render, antes
 * de cualquier peticion, asi que capturaria el esqueleto y pareceria un fallo
 * de la pantalla cuando lo seria de la captura.
 */
const PASOS = [
  { n: 1, ruta: "/welcome", artboard: "Onboarding1", ancla: /comencemos/i },
  { n: 2, ruta: "/business-hours", artboard: "Onboarding2", ancla: /lunes/i },
  { n: 3, ruta: "/add-employee", artboard: "Onboarding3", ancla: /crear cuenta de acceso/i },
  { n: 4, ruta: "/add-service", artboard: "Onboarding4", ancla: /la duracion decide/i },
  { n: 5, ruta: "/complete", artboard: "Onboarding5", ancla: /tu pagina de reservas/i },
]

test.beforeAll(() => {
  fs.mkdirSync(OUT, { recursive: true })
})

test("captura los 10 artboards del diseno", async ({ page }) => {
  for (const paso of PASOS) {
    for (const [nombre, vp, sufijo] of [
      ["movil", MOBILE, ""],
      ["escritorio", DESKTOP, "Desktop"],
    ] as const) {
      const fichero = path.resolve(`design/${paso.artboard}${sufijo}.dc.html`)
      expect(fs.existsSync(fichero), `falta el artboard ${fichero}`).toBe(true)

      await page.setViewportSize(vp)
      await page.goto(`file://${fichero}`)
      // Las fuentes vienen de Google Fonts; sin esto se captura el fallback.
      await page.evaluate(() => document.fonts.ready)
      await page.screenshot({
        path: path.join(OUT, `paso${paso.n}-${nombre}-diseno.png`),
      })
    }
  }
})

test("captura las 5 pantallas construidas", async ({ page }) => {
  const email = process.env.RIVOO_E2E_EMAIL
  const password = process.env.RIVOO_E2E_PASSWORD
  expect(email, "falta RIVOO_E2E_EMAIL").toBeTruthy()
  expect(password, "falta RIVOO_E2E_PASSWORD").toBeTruthy()

  // El login de la app NO es un formulario: es una pantalla con un boton que
  // entrega a Keycloak. El middleware manda a /login, alli se pulsa, y solo
  // entonces aparece el formulario de Keycloak en el puerto 9080.
  await page.setViewportSize(DESKTOP)
  await page.goto("/welcome")
  await page.waitForURL(/\/login|localhost:9080/, { timeout: 60_000 })

  if (!page.url().includes("9080")) {
    await page.getByRole("button", { name: /iniciar sesion/i }).click()
    await page.waitForURL(/localhost:9080/, { timeout: 60_000 })
  }

  await page.fill("#username", email!)
  await page.fill("#password", password!)
  await page.click("#kc-login")
  await page.waitForURL(/localhost:3000/, { timeout: 60_000 })

  for (const paso of PASOS) {
    for (const [nombre, vp] of [
      ["movil", MOBILE],
      ["escritorio", DESKTOP],
    ] as const) {
      await page.setViewportSize(vp)
      await page.goto(paso.ruta)
      await expect(page.getByText(paso.ancla).first()).toBeVisible({
        timeout: 30_000,
      })
      await page.evaluate(() => document.fonts.ready)
      await page.screenshot({
        path: path.join(OUT, `paso${paso.n}-${nombre}-construido.png`),
      })
    }
  }
})
