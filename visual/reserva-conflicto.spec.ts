import { test, expect, type Page } from "@playwright/test"
import path from "node:path"

/**
 * Prueba de punta a punta de la reserva publica Y captura de las dos pantallas
 * terminales, que la comparacion por pasos no puede alcanzar.
 *
 * El truco es reservar DOS veces el mismo hueco: la primera crea la cita de
 * verdad y deja ver el paso 6; la segunda choca con ella y produce el conflicto
 * real —no simulado— que pinta la pantalla de "ese hueco se acaba de ocupar".
 * Es la unica forma de probar que esa pantalla es alcanzable con el backend
 * real, que responde 422 sin discriminador y obliga a deducir el conflicto
 * re-consultando la disponibilidad.
 *
 * CREA UNA CITA REAL en el salon de pruebas. No lanzar contra datos que
 * importen.
 */

const OUT = path.resolve("../rivoo/docs/specs/reserva-escritorio/verificacion")
const SLUG = process.env.RIVOO_E2E_SLUG ?? "test-barbershop-e2e"
const SERVICE_ID = process.env.RIVOO_E2E_SERVICE ?? "svc_96930063-5cab-4b77-bffc-b5c7a0dda6fc"
const EMPLOYEE_ID = process.env.RIVOO_E2E_EMPLOYEE ?? "emp_0c97c765-4102-41cc-b35f-f314be8dcad9"

/** Recorre el asistente y se DETIENE en el paso 5. Devuelve la hora elegida. */
async function reservarHastaConfirmar(page: Page, ancho: number): Promise<string> {
  await page.setViewportSize({ width: ancho, height: ancho === 390 ? 844 : 900 })
  await page.goto(`/book/${SLUG}`)

  await page.getByText(/corte caballero/i).first().click()
  await page.getByText(/sin preferencia/i).first().click()

  const huecos = page.getByRole("button", { name: /^\d{2}:\d{2}$/ })
  const diasAbiertos = page.locator(
    '[data-testid^="mobile-day-"]:not([disabled]), [data-testid^="desktop-day-"]:not([disabled])'
  )
  const abiertos = await diasAbiertos.count()
  for (let i = 0; i < Math.min(abiertos, 8) && (await huecos.count()) === 0; i++) {
    await diasAbiertos.nth(i).click()
    await expect(async () => {
      expect(await page.getByText(/manana|tarde|no hay huecos/i).count()).toBeGreaterThan(0)
    }).toPass({ timeout: 15_000 })
  }
  expect(await huecos.count(), "ningun dia abierto tiene huecos").toBeGreaterThan(0)

  const hora = (await huecos.first().textContent())?.trim() ?? ""
  await huecos.first().click()
  await page.getByRole("button", { name: /continuar/i }).first().click()

  await page.getByLabel(/nombre/i).first().fill("Ana")
  await page.getByLabel(/apellidos/i).first().fill("Garcia")
  await page.getByLabel(/email/i).first().fill("ana@example.com")
  await page.getByLabel(/telefono/i).first().fill("612345678")
  await page.getByRole("checkbox").first().click()
  await page.getByRole("button", { name: /revisar reserva/i }).first().click()

  await expect(page.getByText(/el salon confirmara tu reserva/i).first()).toBeVisible({
    timeout: 30_000,
  })
  return hora
}

/** El recorrido entero, incluida la confirmacion. */
async function reservar(page: Page, ancho: number): Promise<string> {
  const hora = await reservarHastaConfirmar(page, ancho)
  await page.getByRole("button", { name: /confirmar reserva/i }).first().click()
  return hora
}

for (const ancho of [390, 1440] as const) {
  test(`reserva real y conflicto real a ${ancho}px`, async ({ page }) => {
    // Se anota la fecha que el asistente esta consultando: hace falta para
    // robarle el hueco por detras, y sale de la propia peticion que hace.
    let fecha = ""
    page.on("request", (r) => {
      const url = new URL(r.url())
      if (url.pathname.endsWith("/appointments/public/availability")) {
        fecha = url.searchParams.get("date") ?? fecha
      }
    })

    // Primera reserva completa: crea la cita y deja ver la pantalla de exito.
    await reservar(page, ancho)
    await expect(page.getByText(/reserva confirmada/i).first()).toBeVisible({ timeout: 30_000 })
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({ path: path.join(OUT, `paso6-${ancho}-construido.png`), fullPage: true })

    // Segundo visitante: llega hasta confirmar con un hueco libre...
    const hora = await reservarHastaConfirmar(page, ancho)
    expect(fecha, "no se pudo averiguar la fecha consultada").not.toBe("")

    // ...y justo entonces otra persona se lo quita. Es el escenario exacto que
    // la pantalla de conflicto existe para cubrir, y la unica forma de
    // provocarlo de verdad: si se reservara antes, el hueco ya no apareceria
    // en la rejilla y el visitante nunca lo habria elegido.
    const robo = await page.request.post("http://localhost:8080/api/v1/appointments/book", {
      data: {
        salonSlug: SLUG,
        serviceExternalId: SERVICE_ID,
        employeeExternalId: EMPLOYEE_ID,
        requestedTime: `${fecha}T${hora}:00`,
        clientFirstName: "Otro",
        clientLastName: "Visitante",
        clientEmail: "otro@example.com",
        clientPhone: "600000000",
      },
    })
    expect(robo.status(), `el robo del hueco fallo: ${await robo.text()}`).toBe(201)

    await page.getByRole("button", { name: /confirmar reserva/i }).first().click()
    await expect(page.getByText(/se acaba de ocupar/i).first()).toBeVisible({ timeout: 30_000 })
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({ path: path.join(OUT, `error-${ancho}-construido.png`), fullPage: true })
  })
}
