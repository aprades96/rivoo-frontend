import { test, expect, type Page } from "@playwright/test"
import path from "node:path"
import fs from "node:fs"

/**
 * Captura, a la misma anchura, el artboard del diseno y la pantalla construida,
 * para los seis pasos de la reserva publica y la pantalla de hueco ocupado.
 *
 * No compara pixeles automaticamente a proposito: un umbral numerico sobre dos
 * imagenes que no son el mismo render (fuentes, antialiasing) da falsos rojos y
 * falsos verdes por igual. Lo que produce es el par de imagenes para que las
 * mire una persona, que es lo que falta por hacer en este bloque.
 *
 * A diferencia del asistente de alta, aqui NO hay login: la reserva publica es
 * anonima. Solo hace falta la pila levantada (gateway 8080, salon 8082,
 * staff 8083, appointment 8085) y `npm run dev`.
 */

const OUT = path.resolve("../rivoo/docs/specs/reserva-escritorio/verificacion")

/**
 * Las cuatro anchuras son los cuatro tramos de la decision de breakpoints, no
 * una muestra al azar: 390 es el artboard movil, 768 y 1024 son justo donde
 * cambia la composicion (cabecera y stepper en md:, dos columnas en lg:) y
 * 1440 es el artboard de escritorio. Los bordes son donde se rompe.
 */
const ANCHURAS = [390, 768, 1024, 1440] as const

const SLUG = process.env.RIVOO_E2E_SLUG ?? "test-barbershop-e2e"

/**
 * `ancla` es contenido que solo existe cuando la pantalla YA tiene sus datos.
 * NO vale el texto del chasis: lo pinta el primer render, antes de cualquier
 * peticion, asi que se capturaria el esqueleto y pareceria un fallo de la
 * pantalla cuando lo seria de la captura. Es el defecto exacto que tuvimos en
 * la comparacion del alta reanudable.
 */
const PASOS = [
  { n: 1, artboard: "ReservaPaso1", desktop: "ReservaDesktopPaso1", ancla: /corte caballero/i },
  { n: 2, artboard: "ReservaPaso2", desktop: "ReservaDesktopPaso2", ancla: /sin preferencia/i },
  { n: 3, artboard: "ReservaPaso3", desktop: "ReservaDesktopPaso3", ancla: /manana|tarde|no hay huecos/i },
  { n: 4, artboard: "ReservaPaso4", desktop: "ReservaDesktopPaso4", ancla: /solo para gestionar/i },
  { n: 5, artboard: "ReservaPaso5", desktop: "ReservaDesktopPaso5", ancla: /el salon confirmara tu reserva/i },
]

test.beforeAll(() => {
  fs.mkdirSync(OUT, { recursive: true })
})

test("captura los 14 artboards del diseno", async ({ page }) => {
  const todos = [
    ...PASOS.flatMap((p) => [p.artboard, p.desktop]),
    "ReservaPaso6",
    "ReservaDesktopPaso6",
    "ReservaError",
    "ReservaErrorDesktop",
  ]

  for (const nombre of todos) {
    const fichero = path.resolve(`design/${nombre}.dc.html`)
    expect(fs.existsSync(fichero), `falta el artboard ${fichero}`).toBe(true)

    const esEscritorio = nombre.includes("Desktop")
    await page.setViewportSize({
      width: esEscritorio ? 1440 : 390,
      height: esEscritorio ? 900 : 844,
    })
    await page.goto(`file://${fichero}`)
    // Las fuentes vienen de Google Fonts; sin esto se captura el fallback.
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({ path: path.join(OUT, `${nombre}-diseno.png`) })
  }
})

/** Avanza desde el paso 1 hasta `hasta`, dejando la pantalla lista para capturar. */
async function avanzarHasta(page: Page, hasta: number) {
  // Paso 1: elegir el servicio.
  await expect(page.getByText(/corte caballero/i).first()).toBeVisible({ timeout: 30_000 })
  if (hasta === 1) return
  await page.getByText(/corte caballero/i).first().click()

  // Paso 2: elegir profesional.
  await expect(page.getByText(/sin preferencia/i).first()).toBeVisible({ timeout: 30_000 })
  if (hasta === 2) return
  await page.getByText(/sin preferencia/i).first().click()

  // Paso 3: fecha y hora. Puede no haber huecos hoy; en ese caso la captura
  // documenta el estado vacio, que tambien esta en el artboard.
  await expect(
    page.getByText(/manana|tarde|no hay huecos/i).first()
  ).toBeVisible({ timeout: 30_000 })
  if (hasta === 3) return

  // Hoy puede no quedar ningun hueco -- la reserva publica exige una hora de
  // antelacion, asi que a partir de una hora antes del cierre el dia esta
  // vacio por diseno. Se avanzan dias hasta encontrar uno con huecos en vez de
  // rendirse: si el recorrido se salta los pasos 4 y 5 segun la hora a la que
  // se lance, la comparacion visual deja de ser reproducible.
  const huecos = page.getByRole("button", { name: /^\d{2}:\d{2}$/ })
  // Solo dias HABILITADOS: los cerrados salen `disabled` y Playwright se
  // quedaria esperando a que fueran pulsables hasta agotar el tiempo.
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
  expect(
    await huecos.count(),
    "ninguno de los primeros dias abiertos tiene huecos libres"
  ).toBeGreaterThan(0)
  await huecos.first().click()
  await page.getByRole("button", { name: /continuar/i }).first().click()

  // Paso 4: datos.
  await expect(page.getByText(/solo para gestionar/i).first()).toBeVisible({ timeout: 30_000 })
  if (hasta === 4) return

  await page.getByLabel(/nombre/i).first().fill("Ana")
  await page.getByLabel(/apellidos/i).first().fill("Garcia")
  await page.getByLabel(/email/i).first().fill("ana@example.com")
  await page.getByLabel(/telefono/i).first().fill("612345678")
  await page.getByRole("checkbox").first().click()
  await page.getByRole("button", { name: /revisar reserva/i }).first().click()

  // Paso 5: confirmar. NO se pulsa el CTA: crearia una cita de verdad.
  await expect(
    page.getByText(/el salon confirmara tu reserva/i).first()
  ).toBeVisible({ timeout: 30_000 })
}

for (const paso of PASOS) {
  test(`captura el paso ${paso.n} construido, a las cuatro anchuras`, async ({ page }) => {
    for (const ancho of ANCHURAS) {
      await page.setViewportSize({ width: ancho, height: ancho === 390 ? 844 : 900 })
      await page.goto(`/book/${SLUG}`)
      await avanzarHasta(page, paso.n)
      await expect(page.getByText(paso.ancla).first()).toBeVisible({ timeout: 30_000 })
      await page.evaluate(() => document.fonts.ready)
      await page.screenshot({
        path: path.join(OUT, `paso${paso.n}-${ancho}-construido.png`),
        fullPage: true,
      })
    }
  })
}
