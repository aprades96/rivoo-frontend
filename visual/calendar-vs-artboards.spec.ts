import { test, expect, type Page } from "@playwright/test"
import path from "node:path"
import fs from "node:fs"
import { differenceInCalendarDays, parseISO } from "date-fns"

/**
 * Captura `/calendar`, a los dos frames fijos de sus artboards, junto a la
 * imagen del artboard correspondiente, para que una persona las compare
 * elemento a elemento. Hermana de `visual/shell-vs-artboards.spec.ts` (mismo
 * patron, misma carpeta de salida, mismo login): esa suite ya recorre las
 * doce pantallas del chasis, `/calendar` incluida, pero solo verifica la
 * cabecera comun de `PageShell` -- el INTERIOR de la rejilla (cabeceras de
 * empleado, alineacion de columnas, scroll, los cinco estados del bloque de
 * cita, y en movil la fila de fecha y las pildoras) es justo lo que este
 * bloque 3 acaba de reconstruir y lo que aqui se compara.
 *
 * No compara pixeles automaticamente a proposito: un umbral numerico sobre
 * dos imagenes que no son el mismo render (fuentes, antialiasing) da falsos
 * rojos y falsos verdes por igual. Lo que produce es el par de imagenes para
 * que las mire una persona.
 *
 * QUE MIRAR en cada par de capturas:
 *  - Escritorio, contra `design/CalendarioDesktop.dc.html` (1440x900): la
 *    fila de cabeceras de empleado (avatar + nombre + resumen del dia,
 *    artboard:106-126) tiene que alinear cada cabecera con SU columna de la
 *    rejilla de debajo (artboard:150-236) -- misma cuadricula CSS para las
 *    dos filas, mismo `grid-template-columns` y mismo gap
 *    (`src/components/calendar/day-view.tsx`, funcion `DesktopColumns`). Un
 *    desalineamiento aqui es un bug real, no un pixel suelto de fuente.
 *  - El scroll: la rejilla mide 26 franjas x 48px = 1248px y SIEMPRE
 *    desborda los 900px del frame. Tiene que hacer scroll ELLA SOLA
 *    (`[data-testid="day-view"]`, `overflow-y-auto` propio) dejando la
 *    pagina quieta -- igual que el `overflow: hidden` del propio artboard.
 *    Si en la captura se ve una barra de scroll pegada al borde derecho de
 *    toda la ventana en vez de a la rejilla, es la regresion conocida que
 *    debia arreglar este bloque (ver comentario "ALTO Y SCROLL" en
 *    `day-view.tsx` y `shell-vs-artboards.spec.ts:311-320`, que la dejo
 *    documentada como deuda). Mas abajo hay tambien una comprobacion de
 *    layout (no de pixeles) sobre este mismo punto.
 *  - Los cinco estados del bloque de cita que dibuja el artboard de
 *    escritorio: confirmada (artboard:162, borde verde), pendiente
 *    (artboard:168-175, ambar con etiqueta "Pendiente"), completada
 *    (artboard:193-196, atenuada y a dos lineas), cancelada
 *    (artboard:225-228, roja y a dos lineas) y el descanso "Almuerzo"
 *    (artboard:177-180, rayado, sin borde de color). Corresponden a
 *    `STATUS_STYLES` en `src/components/calendar/appointment-block.tsx` y al
 *    `BreakBlock` aparte -- comparar color de borde, color de fondo y si el
 *    texto se comprime a dos lineas en pendiente/completada/cancelada.
 *  - Movil, contra `design/Calendario.dc.html` (390x844): la fila de fecha
 *    con las dos flechas y el indicador "Hoy" debajo de la fecha
 *    (artboard:37-48), y la tira de pildoras de empleado con avatar +
 *    nombre, la seleccionada en solido (artboard:50-64).
 *
 * PRECONDICION DE DATOS, IMPRESCINDIBLE PARA QUE LA COMPARACION SIRVA DE
 * ALGO: el dia capturado necesita citas variadas. Con un dia vacio la
 * rejilla sale en blanco a ambos lados y no hay nada que comparar con el
 * artboard. Hacen falta, en el dia elegido:
 *   - Varios empleados activos con citas ese dia (para ver varias columnas
 *     en escritorio y varias pildoras con datos en movil).
 *   - Al menos una cita en cada uno de los cuatro estados de arriba
 *     (confirmada, pendiente, completada, cancelada) mas un descanso
 *     configurado para algun empleado ese dia.
 * Por defecto la suite captura EL DIA DE HOY. Si el salon de pruebas no lo
 * tiene sembrado asi, se puede apuntar a otro dia que si lo tenga con
 * `RIVOO_E2E_CALENDAR_DATE` (formato `yyyy-MM-dd`): no hay forma de abrir
 * `/calendar` en una fecha concreta por URL (el estado es local al
 * componente, `src/app/(app)/calendar/page.tsx:51`), asi que la suite
 * navega pulsando el mismo boton de dia siguiente/anterior que usa la
 * pantalla, tantas veces como dias de diferencia haya.
 *
 * Requisitos: la pila levantada (Keycloak, gateway, salon/staff/appointment)
 * y `npm run dev`.
 *
 * Variables: RIVOO_E2E_EMAIL, RIVOO_E2E_PASSWORD (obligatorias),
 * RIVOO_E2E_CALENDAR_DATE (opcional, `yyyy-MM-dd`).
 */

const OUT = path.resolve("../rivoo/docs/specs/shell-escritorio/verificacion")

const MOBILE = { width: 390, height: 844 }
const DESKTOP_1440 = { width: 1440, height: 900 }

test.beforeAll(() => {
  fs.mkdirSync(OUT, { recursive: true })
})

test("captura los artboards del calendario", async ({ page }) => {
  const desktopArtboard = path.resolve("design/CalendarioDesktop.dc.html")
  expect(fs.existsSync(desktopArtboard), `falta el artboard ${desktopArtboard}`).toBe(true)

  await page.setViewportSize(DESKTOP_1440)
  await page.goto(`file://${desktopArtboard}`)
  // Las fuentes vienen de Google Fonts; sin esto se captura el fallback.
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: path.join(OUT, "calendar-agenda-1440-diseno.png") })

  const mobileArtboard = path.resolve("design/Calendario.dc.html")
  expect(fs.existsSync(mobileArtboard), `falta el artboard ${mobileArtboard}`).toBe(true)

  await page.setViewportSize(MOBILE)
  await page.goto(`file://${mobileArtboard}`)
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: path.join(OUT, "calendar-agenda-390-diseno.png") })
})

test("captura /calendar construida", async ({ page }) => {
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
  // enfoque que `shell-vs-artboards.spec.ts`.
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
  // `aptsLoading` pasa a false y sustituye al LoadingSkeleton (mismo ancla
  // que usa `shell-vs-artboards.spec.ts:71-73` para esta misma pantalla).
  await expect(page.getByText(/08:00/).first()).toBeVisible({ timeout: 30_000 })

  await navigateToDate(page, process.env.RIVOO_E2E_CALENDAR_DATE)

  // Movil: fila de fecha + pildoras + rejilla de una columna sin cabeceras.
  await page.setViewportSize(MOBILE)
  await expect(page.getByText(/08:00/).first()).toBeVisible({ timeout: 30_000 })
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: path.join(OUT, "calendar-agenda-390-construido.png") })

  const gridOverflowsMobile = await page
    .getByTestId("day-view")
    .evaluate((el) => el.scrollHeight > el.clientHeight)
  expect(
    gridOverflowsMobile,
    "la rejilla movil no desborda: revisar si faltan franjas horarias"
  ).toBe(true)

  // Escritorio: fila de cabeceras de empleado, una columna por empleado.
  await page.setViewportSize(DESKTOP_1440)
  await expect(page.locator("aside")).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId("employee-column-header").first()).toBeVisible({
    timeout: 30_000,
  })
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: path.join(OUT, "calendar-agenda-1440-construido.png") })

  // Verificacion de LAYOUT, no de pixeles: no decide "es igual al diseno" --
  // eso lo hace la persona mirando el par de capturas de arriba -- pero deja
  // constancia objetiva del punto que mas importaba arreglar en este bloque:
  // que quien desborda y hace scroll sea la rejilla (`day-view.tsx`,
  // `overflow-y-auto` propio dentro de la cadena `h-dvh overflow-hidden` de
  // `(app)/layout.tsx`) y no la pagina entera.
  const pageOverflows = await page.evaluate(
    () => document.documentElement.scrollHeight > window.innerHeight + 1
  )
  expect(
    pageOverflows,
    "la pagina desborda a 1440x900: el scroll se ha escapado de la rejilla " +
      "(regresion conocida documentada en shell-vs-artboards.spec.ts:311-320)"
  ).toBe(false)

  const gridOverflowsDesktop = await page
    .getByTestId("day-view")
    .evaluate((el) => el.scrollHeight > el.clientHeight)
  expect(
    gridOverflowsDesktop,
    "la rejilla de escritorio no desborda: revisar si faltan franjas horarias"
  ).toBe(true)
})

/**
 * No hay forma de abrir `/calendar` en una fecha concreta por URL: el
 * estado vive en un `useState` local (`calendar/page.tsx:51`). Para un dia
 * distinto de hoy, se pulsa el mismo boton de paso de dia que usa la
 * pantalla -- `aria-label` compartido entre la fila movil
 * (`DateNavigatorRow`) y el cluster de escritorio (`DateNavigatorCluster`),
 * las dos construidas sobre el mismo `StepButton`
 * (`src/components/calendar/date-navigator.tsx`) -- tantas veces como dias
 * de diferencia haya con hoy.
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

  // La carga de las citas del nuevo dia esconde temporalmente "08:00"
  // (LoadingSkeleton sustituye a TimeGrid); esperar a que reaparezca es
  // esperar a que el dia de destino ya este cargado.
  await expect(page.getByText(/08:00/).first()).toBeVisible({ timeout: 30_000 })
}
