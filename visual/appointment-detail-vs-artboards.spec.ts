import { test, expect, type Page } from "@playwright/test"
import path from "node:path"
import fs from "node:fs"
import { differenceInCalendarDays, parseISO } from "date-fns"

/**
 * Captura el detalle de cita -- hoja movil y panel de escritorio -- junto a
 * sus artboards, para que una persona las compare elemento a elemento. Mismo
 * patron que `visual/calendar-vs-artboards.spec.ts` (login, viewports,
 * capturas, nombres de artefactos): esa suite ya cubre la rejilla de
 * `/calendar`; esta cubre lo que se abre al pulsar un bloque de cita
 * (plan `detalle-cita`, T11).
 *
 * No compara pixeles automaticamente, por el mismo motivo que la hermana: un
 * umbral numerico entre dos renders distintos (fuentes, antialiasing) da
 * falsos rojos y falsos verdes por igual. Produce el par de imagenes para que
 * las mire una persona.
 *
 * QUE MIRAR en cada par:
 *  - 390x844 contra `design/DetalleCita.dc.html`: la hoja inferior con asa,
 *    badge "Pendiente", filas de hecho (hora/cliente/servicio/empleado/nota)
 *    y el CTA + fila secundaria de dos botones (Confirmar / No asistio /
 *    Cancelar sobre PENDING, D5). Sin boton de cierre.
 *  - 1440x900 contra `design/DetalleCitaDesktop.dc.html`: el panel ACOPLADO
 *    de 360px, hermano de la rejilla (D1) -- no un dialogo con velo --, con
 *    boton X, badge "Pendiente de confirmar", tarjetas `.sec` (cliente con
 *    telefono+dos botones de contacto, SIN email; servicio; empleado con
 *    avatar de iniciales) y recuadro de nota. Comparar tambien que la rejilla
 *    de al lado se ve en modo estrecho (canal de horas 58px, columnas mas
 *    justas).
 *
 * LA TERCERA CAPTURA, A 1024px CON EL PANEL ABIERTO, NO ES UN CASO ROTO SI
 * SALE APRETADA: no tiene artboard contra el que comparar -- nadie ha dibujado
 * el panel a este ancho (D19) -- y por eso este test NUNCA falla por su
 * causa. Es la comprobacion MEDIDA de D19: a 1024px con el panel acoplado las
 * columnas de la rejilla caen a ~99px (contra los ~237px de 1440, que si esta
 * dibujado), y con cinco empleados a ~56px. La imagen se guarda para decidir
 * CON ELLA DELANTE si hace falta dibujar algo para ese ancho -- no para
 * marcarlo como regresion. El test tambien anota (sin exigir) el ancho de
 * columna medido, para no tener que abrir la imagen solo para ese numero.
 *
 * PRECONDICION DE DATOS: el dia capturado necesita, para el primer empleado
 * de la lista (el que el filtro movil selecciona por defecto,
 * `calendar/page.tsx:133`), al menos una cita en estado PENDING visible tanto
 * en la vista movil como en la de escritorio -- es la que dibujan los dos
 * artboards (badge "Pendiente" / "Pendiente de confirmar"). Por defecto la
 * suite captura EL DIA DE HOY; para otro dia, `RIVOO_E2E_CALENDAR_DATE`
 * (`yyyy-MM-dd`), igual que `calendar-vs-artboards.spec.ts`.
 *
 * Requisitos: la pila levantada (Keycloak, gateway, salon/staff/appointment)
 * y `npm run dev`.
 *
 * Variables: RIVOO_E2E_EMAIL, RIVOO_E2E_PASSWORD (obligatorias),
 * RIVOO_E2E_CALENDAR_DATE (opcional, `yyyy-MM-dd`).
 */

const OUT = path.resolve("../rivoo/docs/specs/detalle-cita/verificacion")

const MOBILE = { width: 390, height: 844 }
const DESKTOP_1440 = { width: 1440, height: 900 }
const DESKTOP_NARROW_1024 = { width: 1024, height: 900 }

test.beforeAll(() => {
  fs.mkdirSync(OUT, { recursive: true })
})

test("captura los artboards del detalle de cita", async ({ page }) => {
  const mobileArtboard = path.resolve("design/DetalleCita.dc.html")
  expect(fs.existsSync(mobileArtboard), `falta el artboard ${mobileArtboard}`).toBe(true)

  await page.setViewportSize(MOBILE)
  await page.goto(`file://${mobileArtboard}`)
  // Las fuentes vienen de Google Fonts; sin esto se captura el fallback.
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: path.join(OUT, "appointment-detail-390-diseno.png") })

  const desktopArtboard = path.resolve("design/DetalleCitaDesktop.dc.html")
  expect(fs.existsSync(desktopArtboard), `falta el artboard ${desktopArtboard}`).toBe(true)

  await page.setViewportSize(DESKTOP_1440)
  await page.goto(`file://${desktopArtboard}`)
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: path.join(OUT, "appointment-detail-1440-diseno.png") })
})

test("captura el detalle de cita construido", async ({ page }) => {
  const email = process.env.RIVOO_E2E_EMAIL
  const password = process.env.RIVOO_E2E_PASSWORD
  expect(
    Boolean(email) && Boolean(password),
    "Faltan credenciales: exporta RIVOO_E2E_EMAIL y RIVOO_E2E_PASSWORD antes de lanzar esta suite " +
      "(no se piden por otro medio ni se guardan en el repo)."
  ).toBe(true)

  // El login de la app NO es un formulario: es una pantalla con un boton que
  // entrega a Keycloak. El middleware manda a /login, alli se pulsa, y solo
  // entonces aparece el formulario de Keycloak en el puerto 9080. Mismo
  // enfoque que `calendar-vs-artboards.spec.ts`.
  await page.setViewportSize(MOBILE)
  await page.goto("/calendar")
  await page.waitForURL(/\/login|localhost:9080/, { timeout: 60_000 })

  if (!page.url().includes("9080")) {
    await page.getByRole("button", { name: /iniciar sesion/i }).click()
    await page.waitForURL(/localhost:9080/, { timeout: 60_000 })
  }

  await page.fill("#username", email!)
  await page.fill("#password", password!)
  await page.click("#kc-login")
  await page.waitForURL(/localhost:3000/, { timeout: 60_000 })

  // Explicito, no se asume a donde redirige Keycloak tras el login (mismo
  // motivo que `onboarding-vs-artboards.spec.ts:94-95`).
  await page.goto("/calendar")

  // "08:00" es la primera etiqueta de `TimeGrid`, que solo se monta cuando
  // `aptsLoading` pasa a false y sustituye al LoadingSkeleton.
  await expect(page.getByText(/08:00/).first()).toBeVisible({ timeout: 30_000 })

  await navigateToDate(page, process.env.RIVOO_E2E_CALENDAR_DATE)

  // Movil: pulsar el primer bloque de cita abre la HOJA inferior
  // (`detail-sheet-grabber` es el asa, exclusiva de la hoja -- el panel de
  // escritorio no la lleva, D1 §1.2).
  await expect(page.getByTestId("appointment-block").first()).toBeVisible({ timeout: 30_000 })
  await page.getByTestId("appointment-block").first().click()
  await expect(page.getByTestId("detail-sheet-grabber")).toBeVisible({ timeout: 15_000 })
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: path.join(OUT, "appointment-detail-390-construido.png") })

  // Escritorio 1440: el mismo estado seleccionado (`selectedAppointmentId`
  // vive en la pagina, no en la hoja -- D16) pasa a pintarse como PANEL
  // acoplado en cuanto el ancho cruza `lg` (1024px, D2/D7). No hace falta
  // volver a pulsar el bloque.
  await page.setViewportSize(DESKTOP_1440)
  await expect(page.getByTestId("appointment-detail-panel")).toBeVisible({ timeout: 15_000 })
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: path.join(OUT, "appointment-detail-1440-construido.png") })

  // 1024 con el panel abierto -- comprobacion de D19, ver cabecera del
  // fichero. No hay assert de "es correcto": solo se deja constancia medida
  // del ancho de columna resultante, y se guarda la imagen para decidir.
  await page.setViewportSize(DESKTOP_NARROW_1024)
  await expect(page.getByTestId("appointment-detail-panel")).toBeVisible({ timeout: 15_000 })
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: path.join(OUT, "appointment-detail-1024-construido.png") })

  const firstColumnBox = await page
    .getByTestId("employee-column-header")
    .first()
    .boundingBox()
  test.info().annotations.push({
    type: "D19 -- ancho de columna a 1024px con panel abierto",
    description: firstColumnBox
      ? `${Math.round(firstColumnBox.width)}px (esperado ~99px con tres empleados, ` +
        `~56px con cinco -- ver D19 en el plan). No es un fallo: no hay artboard dibujado a este ancho.`
      : "no se pudo medir: no hay cabecera de columna visible",
  })
})

/**
 * No hay forma de abrir `/calendar` en una fecha concreta por URL: el estado
 * vive en un `useState` local (`calendar/page.tsx`). Para un dia distinto de
 * hoy, se pulsa el mismo boton de paso de dia que usa la pantalla, tantas
 * veces como dias de diferencia haya con hoy. Copiado tal cual de
 * `calendar-vs-artboards.spec.ts`.
 */
async function navigateToDate(page: Page, target: string | undefined): Promise<void> {
  if (!target) return

  const diff = differenceInCalendarDays(parseISO(target), new Date())
  if (Number.isNaN(diff)) {
    throw new Error(
      `RIVOO_E2E_CALENDAR_DATE="${target}" no es una fecha valida (se espera yyyy-MM-dd).`
    )
  }
  if (diff === 0) return

  const label = diff > 0 ? /dia siguiente/i : /dia anterior/i
  const boton = page.getByRole("button", { name: label })
  for (let i = 0; i < Math.abs(diff); i++) {
    await boton.click()
  }

  await expect(page.getByText(/08:00/).first()).toBeVisible({ timeout: 30_000 })
}
