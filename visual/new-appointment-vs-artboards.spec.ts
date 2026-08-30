import { test, expect, type Page } from "@playwright/test"
import path from "node:path"
import fs from "node:fs"

/**
 * Recorre, DE VERDAD (pulsando, no por URL -- el paso vive en el store de
 * Zustand, `src/lib/stores/wizard-store.ts`, no en la ruta), los cinco pasos
 * del asistente de nueva cita (`/appointments/new`), y en cada paso captura
 * las DOS anchuras (390x844 y 1440x900) antes de avanzar al siguiente. El
 * chasis (`new-appointment-shell.tsx`) mantiene `{children}` en la MISMA
 * posicion del arbol en las dos ramas de `isDesktop` -- por eso cambiar de
 * ancho a mitad de paso NO remonta el paso ni pierde el estado del store, y
 * no hace falta rehacer el recorrido una vez por anchura (a diferencia de
 * `reserva-vs-artboards.spec.ts`, que si vuelve a `page.goto` en cada
 * combinacion paso/ancho porque la reserva publica no tiene esa invariante
 * documentada). Mismo patron de login que
 * `appointment-detail-vs-artboards.spec.ts` (Keycloak, `document.fonts.ready`
 * antes de cada captura).
 *
 * No compara pixeles automaticamente, por el mismo motivo que las hermanas: un
 * umbral numerico entre dos renders distintos (fuentes, antialiasing) da
 * falsos rojos y falsos verdes por igual. Produce el par de imagenes para que
 * las mire una persona.
 *
 * QUE MIRAR en cada uno de los diez pares (`NuevaCita{,Desktop}Paso{1..5}.dc.html`
 * contra `paso{1..5}-{390,1440}-construido.png`):
 *  - Paso 1 (Profesional): la lista de profesionales + la fila "Sin
 *    preferencia" (icono de grupo, sin avatar). El empleado que hoy no
 *    trabaja SIGUE siendo pulsable (`employee-step.tsx:234-238`, el asistente
 *    reserva a 30 dias vista) y conserva su chevron en movil -- solo se
 *    atenua (avatar+texto), nunca se deshabilita ni pierde el icono.
 *  - Paso 2 (Servicio): las tarjetas de servicio, con la duracion PEGADA a la
 *    unidad ("45min", `formatDurationTight` -- no "45 min").
 *  - Paso 3 (Fecha y hora): la tira/rejilla de dias -- el horizonte real es de
 *    30 dias (`MOBILE_STRIP_DAYS`/`DESKTOP_WEEK_PAGES`, `datetime-step.tsx:36-38`),
 *    la tira solo ENSEÑA 6-7 celdas a la vez y en escritorio se navega con las
 *    flechas "Semana anterior"/"Semana siguiente" -- y los huecos de
 *    manana/tarde. `AvailabilityResponse.slots` (backend) solo trae los
 *    huecos LIBRES: no hay contador "N huecos" por dia ni huecos ocupados
 *    tachados en la pantalla construida, aunque el artboard los dibuje --
 *    hueco de backend documentado en `datetime-step.tsx:139-149`, NO lo
 *    marques como fallo de esta pantalla.
 *  - Paso 4 (Cliente): el buscador + la tarjeta discontinua "Crear nuevo
 *    cliente" + "Clientes recientes" (solo en movil, con `search === ""`).
 *    TODAS las filas de cliente pintaran "0 visitas": `client.totalVisits`
 *    vale 0 para todos hoy porque ningun endpoint del backend lo incrementa
 *    (`client-step.tsx:269-275`) -- es correcto y deliberado, no lo marques
 *    como fallo.
 *  - Paso 5 (Confirmacion): la tarjeta de resumen (hora, badge de estado,
 *    cliente/profesional/servicio) + el total. En escritorio, ademas, el
 *    aside con el CTA "Crear cita".
 *  - Escritorio, los cinco pasos: el aside de 320px (`WizardSummaryAside`)
 *    NO es identico en los cinco -- tres variaciones medidas, no un fallo de
 *    consistencia: el paso 1 pinta "Sin elegir" en tono placeholder para la
 *    fila Profesional (`wizard-summary.ts:100-101`); los pasos 3 y 4 anaden
 *    una segunda linea de duracion·precio bajo el Servicio; desde el paso 4
 *    la fila Fecha y hora pasa de solo la hora de inicio al rango completo; y
 *    la fila Total solo aparece en el paso 5.
 *
 * PRECONDICION DE DATOS: el salon necesita, para que el recorrido llegue al
 * paso 5, al menos UN empleado activo con al menos UN servicio asignado y con
 * huecos libres en los proximos dias (el recorrido prueba varios servicios y
 * varias semanas antes de rendirse, ver `advanceFromStep2`/`advanceFromStep3`
 * mas abajo), y al menos UN cliente ya dado de alta (para que aparezca en
 * "Clientes recientes"/la busqueda vacia del paso 4). Sin esto el test falla
 * con un mensaje explicito senalando cual de las dos condiciones no se
 * cumplio, no con un timeout ciego.
 *
 * Requisitos: la pila levantada (Keycloak, gateway, salon/staff/appointment)
 * y `npm run dev`.
 *
 * Variables: RIVOO_E2E_EMAIL, RIVOO_E2E_PASSWORD (obligatorias, nunca en el
 * repo).
 */

const OUT = path.resolve("../rivoo/docs/specs/asistente-nueva-cita/verificacion")

const MOBILE = { width: 390, height: 844 }
const DESKTOP = { width: 1440, height: 900 }

const PASOS = [1, 2, 3, 4, 5] as const

test.beforeAll(() => {
  fs.mkdirSync(OUT, { recursive: true })
})

test("captura los diez artboards del diseno", async ({ page }) => {
  for (const n of PASOS) {
    for (const variant of ["", "Desktop"] as const) {
      const isDesktop = variant === "Desktop"
      const nombre = `NuevaCita${variant}Paso${n}`
      const fichero = path.resolve(`design/${nombre}.dc.html`)
      expect(fs.existsSync(fichero), `falta el artboard ${fichero}`).toBe(true)

      await page.setViewportSize(isDesktop ? DESKTOP : MOBILE)
      await page.goto(`file://${fichero}`)
      // Las fuentes vienen de Google Fonts; sin esto se captura el fallback.
      await page.evaluate(() => document.fonts.ready)
      await page.screenshot({ path: path.join(OUT, `${nombre}-diseno.png`) })
    }
  }
})

test("recorre y captura el asistente de nueva cita construido, a las dos anchuras", async ({ page }) => {
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
  // enfoque que `appointment-detail-vs-artboards.spec.ts`.
  await page.setViewportSize(MOBILE)
  await page.goto("/appointments/new")
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
  await page.goto("/appointments/new")

  for (const n of PASOS) {
    await captureStep(page, n)

    if (n === 1) await advanceFromStep1(page)
    else if (n === 2) await advanceFromStep2(page)
    else if (n === 3) await advanceFromStep3(page)
    else if (n === 4) await advanceFromStep4(page)
    // Paso 5: NO se pulsa "Crear cita" -- crearia una cita de verdad, mismo
    // motivo que `reserva-vs-artboards.spec.ts:130`.
  }
})

/**
 * Texto que solo existe cuando el paso YA tiene sus datos (no el esqueleto de
 * `LoadingSkeleton`). Uno por paso -- ver la cabecera del fichero para por que
 * cada uno es seguro (no ambiguo con botones de cromo ni con otros pasos).
 */
const STEP_DATA_ANCHOR: Record<(typeof PASOS)[number], RegExp> = {
  1: /sin preferencia/i,
  2: /\d+,\d{2}\s*€/,
  3: /mañana|tarde|no hay huecos/i,
  4: /visita/i,
  5: /\d+,\d{2}\s*€/,
}

/** Captura un paso a las dos anchuras, sin avanzar. */
async function captureStep(page: Page, n: (typeof PASOS)[number]) {
  await page.setViewportSize(MOBILE)
  await waitForStepReady(page, n, false)
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: path.join(OUT, `paso${n}-390-construido.png`) })

  await page.setViewportSize(DESKTOP)
  await waitForStepReady(page, n, true)
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: path.join(OUT, `paso${n}-1440-construido.png`) })
}

/**
 * Espera dos cosas antes de dar el paso por listo para capturar: (1) que la
 * rama de ancho correcta ya este pintada -- tras `page.setViewportSize` React
 * tiene que re-renderizar, y `isDesktop` tarda un tick -- y (2) que el paso ya
 * tenga sus datos, no el esqueleto de carga. Ancla de escritorio: "Confirmar"
 * (ultima etiqueta de `WizardStepper`, constante en los cinco pasos, visible
 * SOLO cuando `isDesktop` monta el stepper). Ancla de movil: "Paso N de 5"
 * (unico texto de `NewAppointmentShell` que existe SOLO en la rama movil,
 * `new-appointment-shell.tsx:117-119`).
 */
async function waitForStepReady(page: Page, n: (typeof PASOS)[number], isDesktopNow: boolean) {
  if (isDesktopNow) {
    await expect(page.getByText(/confirmar/i).first()).toBeVisible({ timeout: 15_000 })
  } else {
    await expect(page.getByText(/Paso \d de 5/).first()).toBeVisible({ timeout: 15_000 })
  }
  await expect(page.getByText(STEP_DATA_ANCHOR[n]).first()).toBeVisible({ timeout: 30_000 })
}

/** Paso 1 -> 2: "Sin preferencia" avanza solo (`employee-step.tsx:157-160`, sin CTA aparte). */
async function advanceFromStep1(page: Page) {
  await page.getByRole("button", { name: /sin preferencia/i }).click()
  await expect(page.getByRole("heading", { name: /elige un servicio/i })).toBeVisible({ timeout: 15_000 })
}

/**
 * Paso 2 -> 3: con "Sin preferencia" TODOS los servicios se pintan
 * habilitados (`service-step.tsx:91`, `isOffered` es siempre `true` sin
 * empleado concreto) aunque nadie los ofrezca de verdad -- el paso 3 es quien
 * lo descubre (`noOneOffersService`, `datetime-step.tsx:123`) y pinta "Ningun
 * profesional ofrece este servicio" con un boton para volver. Se prueban los
 * servicios EN ORDEN hasta encontrar uno con profesional real, en vez de
 * asumir que el primero sirve -- la precondicion del fichero solo promete que
 * ALGUN servicio tiene alguien que lo ofrezca, no cual.
 */
async function advanceFromStep2(page: Page) {
  const serviceButtons = page.getByRole("button", { name: /\d+,\d{2}\s*€/ })
  await expect(serviceButtons.first()).toBeVisible({ timeout: 30_000 })
  const total = await serviceButtons.count()

  for (let i = 0; i < total; i++) {
    await page.getByRole("button", { name: /\d+,\d{2}\s*€/ }).nth(i).click()
    await expect(page.getByRole("heading", { name: /elige fecha y hora/i })).toBeVisible({ timeout: 15_000 })

    const noOneOffers = await page
      .getByText(/ningún profesional ofrece este servicio/i)
      .first()
      .isVisible()
    if (!noOneOffers) return

    await page.getByRole("button", { name: /volver a servicios/i }).click()
    await expect(page.getByRole("heading", { name: /elige un servicio/i })).toBeVisible({ timeout: 15_000 })
  }

  throw new Error(
    "Ninguno de los servicios visibles tiene un profesional real que lo ofrezca -- revisa la " +
      "precondicion de datos en la cabecera del fichero (empleado con servicio asignado)."
  )
}

/**
 * Paso 3 -> 4: busca un hueco libre, probando dias dentro de la pagina de
 * semana actual y, si ninguno tiene hueco, avanzando de semana (solo
 * escritorio pagina por semanas -- `DesktopCalendar`, `DESKTOP_WEEK_PAGES = 4`;
 * la tira movil ya monta los 30 dias de una vez). El selector de dias
 * combina los dos prefijos de testid (`mobile-day-`/`desktop-day-`) igual que
 * `reserva-vs-artboards.spec.ts:102-104`: solo uno de los dos esta montado a
 * la vez, asi que la combinacion es segura sin mirar el ancho actual.
 * Encontrado el hueco, hace falta pulsar "Continuar" aparte
 * (`handleSlotSelect` NO llama a `nextStep`, a diferencia de los demas pasos
 * -- `datetime-step.tsx:194-196`).
 */
async function advanceFromStep3(page: Page) {
  const huecos = page.getByRole("button", { name: /^\d{2}:\d{2}$/ })
  const diasAbiertos = page.locator(
    '[data-testid^="mobile-day-"]:not([disabled]), [data-testid^="desktop-day-"]:not([disabled])'
  )

  for (let semana = 0; semana < 4 && (await huecos.count()) === 0; semana++) {
    const abiertos = await diasAbiertos.count()
    for (let i = 0; i < abiertos && (await huecos.count()) === 0; i++) {
      await diasAbiertos.nth(i).click()
      await expect(async () => {
        expect(await page.getByText(/mañana|tarde|no hay huecos/i).count()).toBeGreaterThan(0)
      }).toPass({ timeout: 15_000 })
    }

    if ((await huecos.count()) === 0) {
      const semanaSiguiente = page.getByRole("button", { name: /semana siguiente/i })
      if ((await semanaSiguiente.count()) === 0 || !(await semanaSiguiente.isEnabled())) break
      await semanaSiguiente.click()
    }
  }

  expect(
    await huecos.count(),
    "ningun dia probado (varias semanas) tiene huecos libres para este servicio"
  ).toBeGreaterThan(0)

  await huecos.first().click()
  await page.getByRole("button", { name: /continuar/i }).first().click()
  await expect(page.getByRole("heading", { name: /selecciona un cliente/i })).toBeVisible({ timeout: 15_000 })
}

/**
 * Paso 4 -> 5: elige el primer cliente de la lista (busqueda vacia = "Clientes
 * recientes"/todos). "visita" -- singular o plural, `visitsLabel` en
 * `client-step.tsx:280` -- distingue la fila de cliente de la tarjeta "Crear
 * nuevo cliente" (que no lleva esa palabra), sin depender de nombres reales.
 */
async function advanceFromStep4(page: Page) {
  const clientButtons = page.getByRole("button", { name: /visita/i })
  await expect(clientButtons.first()).toBeVisible({ timeout: 30_000 })
  await clientButtons.first().click()
  await expect(page.getByRole("heading", { name: /confirma la cita/i })).toBeVisible({ timeout: 15_000 })
}
