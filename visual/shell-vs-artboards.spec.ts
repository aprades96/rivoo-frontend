import { test, expect } from "@playwright/test"
import path from "node:path"
import fs from "node:fs"

/**
 * Captura, a la misma anchura, el artboard del diseno y la pantalla construida,
 * para las doce pantallas del chasis de la app interna (`src/app/(app)/`), en
 * movil y en escritorio.
 *
 * No compara pixeles automaticamente a proposito: un umbral numerico sobre dos
 * imagenes que no son el mismo render (fuentes, antialiasing) da falsos rojos
 * y falsos verdes por igual. Lo que produce es el par de imagenes para que las
 * mire una persona, que es lo que falta por hacer en este bloque.
 *
 * QUE MIRAR en el par de `/today` (bloque 5, T9) -- la pantalla se acaba de
 * reconstruir entera, asi que esto apunta a lo que de verdad puede haber
 * salido mal, no a un repaso generico. Leer esto ANTES de abrir las imagenes:
 *
 *  - MOVIL (`Main`, 390): cabecera de 56px con el NOMBRE DEL SALON (no el
 *    saludo -- el saludo va en el cuerpo, 27px con `line-height 1.1`); TRES
 *    KPIs con icono de 14px y label de 11px, el de "Pendientes" con fondo y
 *    texto de alerta; tarjeta "Ahora mismo" con el rotulo DENTRO y la hora
 *    actual al lado; filas de cita con icono de tijeras, precio dentro de la
 *    linea de servicio y una TERCERA linea (empleado + rango horario). NO debe
 *    haber tarjeta de reservas online, ni KPI de facturacion, ni tarjeta
 *    "Proxima cita". El FAB y la barra inferior los pinta el layout, no la
 *    pagina: comprobar que no salen duplicados.
 *
 *  - ESCRITORIO (`HoyDesktop`, 1440): CUATRO KPIs SIN icono, label de 12px; el
 *    de facturacion dice "412 €" ENTERO, sin decimales. Dos columnas
 *    `1.6fr / 1fr`. Rotulo "Ahora mismo" FUERA de la tarjeta y sin hora. Filas
 *    de cita con "servicio · empleado", precio en columna propia, sin tercera
 *    linea. Tarjeta de reservas online debajo del panel.
 *
 *  - DIFERENCIA ESPERADA, NO ES UN FALLO DE ESTA PANTALLA: a 1440px el
 *    contenido sale a 1084px de ancho porque `page-shell.tsx:131` impone
 *    `max-w-[1084px]`, mientras el artboard dibuja 1136px (1440 - 248 de barra
 *    lateral - 56 de `px-7`). Es deuda del chasis que comparten las doce
 *    rutas de este bloque, no algo especifico de "Hoy". El padding SI coincide
 *    (`px-7 py-6` = los `24px 28px` del artboard).
 *
 *  - TAMBIEN INTENCIONAL, NO LO REPORTES: en el par de escritorio, la fila
 *    "En curso" NO lleva un borde distinto de las demas -- va con el mismo
 *    `#E7DCCF` de siempre. El artboard dibuja `#DCC9BB` ahi, pero se decidio
 *    no seguirlo porque el artboard MOVIL dibuja esa misma fila sin borde
 *    diferenciado: seguir al de escritorio habria introducido una
 *    inconsistencia entre los dos artboards, no resuelto una.
 *
 *  - EN LOS DOS PARES: que ningun texto quede con el `line-height` 1.5 de la
 *    preflight de Tailwind donde el artboard dibuja ~1.25 (el fallo mas
 *    repetido de este repo), y que no aparezcan hexes sueltos donde el resto
 *    del repo usa tokens.
 *
 * Requisitos: la pila levantada (Keycloak, gateway, salon/staff/client/billing)
 * y `npm run dev`.
 *
 * PRECONDICION, Y NO ES OPCIONAL: el salon del usuario de prueba debe tener
 * `onboarding_completed_at` NO nulo. Si es `NULL`, `OnboardingGate`
 * (`src/components/layout/onboarding-gate.tsx`) redirige a `/welcome` y esta
 * suite fotografiaria el asistente de alta en vez del chasis.
 *
 * OJO, CONFLICTO CON OTRA SUITE: `visual/onboarding-vs-artboards.spec.ts:15-16`
 * exige justo lo contrario (`onboarding_completed_at = NULL`) para sus propias
 * capturas. Las dos suites NO PUEDEN correr con el mismo estado de base de
 * datos -- lanzarlas por separado, cada una con el salon en el estado que le
 * corresponde.
 *
 * Variables: RIVOO_E2E_EMAIL, RIVOO_E2E_PASSWORD.
 */

const OUT = path.resolve("../rivoo/docs/specs/shell-escritorio/verificacion")

const MOBILE = { width: 390, height: 844 }
const DESKTOP_1024 = { width: 1024, height: 900 }
const DESKTOP_1440 = { width: 1440, height: 900 }

interface Pantalla {
  nombre: string
  /**
   * `null` en las dos fichas de detalle: su id sale de una navegacion real
   * por la UI (ver mas abajo), nunca de un id inventado a mano que podria
   * dejar de existir en la base del entorno.
   */
  ruta: string | null
  /** Fichero en `design/`, sin extension. Frame fijo de 390x844. */
  artboardMovil: string
  /**
   * Contenido REAL de la pantalla, nunca texto del chasis (el titulo de
   * PageShell se pinta en el primer render, antes de cualquier peticion).
   * Cuando la pantalla puede estar vacia o llena, la alternancia cubre las
   * dos formas legitimas del mismo contenido real.
   */
  ancla: RegExp
}

const PANTALLAS: Pantalla[] = [
  {
    nombre: "today",
    ruta: "/today",
    artboardMovil: "Main",
    ancla: /todas las citas de hoy|aun no tienes servicios/i,
  },
  {
    nombre: "calendar",
    ruta: "/calendar",
    artboardMovil: "Calendario",
    // "X citas" se pinta ANTES de que llegue la respuesta (parte de 0 citas
    // mientras `aptsLoading` es true), asi que no vale como ancla. "08:00" es
    // la primera etiqueta de `TimeGrid` (day-view.tsx), que solo se monta
    // cuando `aptsLoading` pasa a false y sustituye al LoadingSkeleton.
    ancla: /08:00/,
  },
  {
    nombre: "clients",
    ruta: "/clients",
    artboardMovil: "Clientes",
    ancla: /\d+ clientes?|sin clientes|sin resultados/i,
  },
  {
    nombre: "clients-detalle",
    ruta: null,
    artboardMovil: "DetalleCliente",
    // No el nombre del cliente (title=fullName): coincide con el titulo
    // "chasis" que ya pinta el propio PageShell, y aqui interesa un contenido
    // que NO exista en la rama de carga (LoadingSkeleton bajo el mismo titulo
    // estatico "Cliente"). Las stats de visitas solo existen tras cargar.
    ancla: /visitas/i,
  },
  {
    nombre: "staff",
    ruta: "/staff",
    artboardMovil: "Equipo",
    ancla: /\d+ empleados?|sin empleados/i,
  },
  {
    nombre: "staff-detalle",
    ruta: null,
    artboardMovil: "DetalleEmpleado",
    // Igual motivo que en clients-detalle: el titulo se unifico con el
    // nombre del empleado (decision del usuario, staff/[id]/page.tsx:126-128)
    // y tambien esta ausente en la rama de carga. El badge Activo/Inactivo
    // solo se pinta con el empleado ya cargado.
    ancla: /activo|inactivo/i,
  },
  {
    nombre: "settings",
    ruta: "/settings",
    artboardMovil: "Ajustes",
    ancla: /cerrar sesion/i,
  },
  {
    nombre: "settings-salon",
    ruta: "/settings/salon",
    artboardMovil: "AjustesSalon",
    // "Slug:" vive dentro del `salon &&` (salon/page.tsx:94-100): solo
    // aparece con el salon ya cargado, a diferencia de las etiquetas Nombre/
    // Telefono/Descripcion, que tambien pinta el formulario vacio.
    ancla: /slug:/i,
  },
  {
    nombre: "settings-horario",
    ruta: "/settings/business-hours",
    artboardMovil: "Horario",
    ancla: /lunes/i,
  },
  {
    nombre: "settings-facturacion",
    ruta: "/settings/billing",
    artboardMovil: "AjustesFacturacion",
    // "Planes disponibles" queda fuera del `if (subLoading)` de arriba: solo
    // se pinta una vez resuelta la suscripcion.
    ancla: /planes disponibles/i,
  },
  {
    nombre: "settings-reservas",
    ruta: "/settings/booking",
    artboardMovil: "AjustesReserva",
    // Dentro del `salon &&` (booking/page.tsx:57-75): antes de cargar el
    // salon no existe boton "Abrir pagina de reservas".
    ancla: /abrir pagina de reservas/i,
  },
  {
    nombre: "settings-cuenta",
    ruta: "/settings/account",
    artboardMovil: "AjustesCuenta",
    ancla: /cambiar contraseña/i,
  },
]

/** Los cuatro artboards de escritorio pedidos, todos frames fijos de 1440x900. */
const ARTBOARDS_ESCRITORIO: { nombre: string; artboard: string }[] = [
  { nombre: "today", artboard: "HoyDesktop" },
  { nombre: "staff", artboard: "EquipoDesktop" },
  { nombre: "clients", artboard: "ClientesDesktop" },
  { nombre: "settings", artboard: "AjustesDesktop" },
]

test.beforeAll(() => {
  fs.mkdirSync(OUT, { recursive: true })
})

test("captura los artboards del diseno", async ({ page }) => {
  for (const p of PANTALLAS) {
    const fichero = path.resolve(`design/${p.artboardMovil}.dc.html`)
    expect(fs.existsSync(fichero), `falta el artboard ${fichero}`).toBe(true)

    await page.setViewportSize(MOBILE)
    await page.goto(`file://${fichero}`)
    // Las fuentes vienen de Google Fonts; sin esto se captura el fallback.
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({ path: path.join(OUT, `${p.nombre}-390-diseno.png`) })
  }

  for (const d of ARTBOARDS_ESCRITORIO) {
    const fichero = path.resolve(`design/${d.artboard}.dc.html`)
    expect(fs.existsSync(fichero), `falta el artboard ${fichero}`).toBe(true)

    await page.setViewportSize(DESKTOP_1440)
    await page.goto(`file://${fichero}`)
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({ path: path.join(OUT, `${d.nombre}-1440-diseno.png`) })
  }
})

test("captura las pantallas construidas", async ({ page }) => {
  const email = process.env.RIVOO_E2E_EMAIL
  const password = process.env.RIVOO_E2E_PASSWORD
  expect(email, "falta RIVOO_E2E_EMAIL").toBeTruthy()
  expect(password, "falta RIVOO_E2E_PASSWORD").toBeTruthy()

  // El login de la app NO es un formulario: es una pantalla con un boton que
  // entrega a Keycloak. El middleware manda a /login, alli se pulsa, y solo
  // entonces aparece el formulario de Keycloak en el puerto 9080. Mismo
  // enfoque que onboarding-vs-artboards.spec.ts, pero apuntando a /today en
  // vez de /welcome: aqui el salon YA tiene onboarding completado, asi que
  // /welcome no es alcanzable (ver precondicion en la cabecera del fichero).
  await page.setViewportSize(MOBILE)
  await page.goto("/today")
  await page.waitForURL(/\/login|localhost:9080/, { timeout: 60_000 })

  if (!page.url().includes("9080")) {
    await page.getByRole("button", { name: /iniciar sesion/i }).click()
    await page.waitForURL(/localhost:9080/, { timeout: 60_000 })
  }

  await page.fill("#username", email!)
  await page.fill("#password", password!)
  await page.click("#kc-login")
  await page.waitForURL(/localhost:3000/, { timeout: 60_000 })

  // 1) Las doce pantallas a 390, contra su artboard movil -- la verificacion
  // PRINCIPAL de este bloque: la cabecera movil de las doce cambio a
  // proposito para coincidir con el diseno.
  for (const p of PANTALLAS) {
    if (!p.ruta) continue // fichas de detalle: navegadas mas abajo por la UI

    await page.setViewportSize(MOBILE)
    await page.goto(p.ruta)
    await expect(page.getByText(p.ancla).first()).toBeVisible({ timeout: 30_000 })
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({ path: path.join(OUT, `${p.nombre}-390-construido.png`) })
  }

  // 2) Las dos fichas de detalle: el id sale de un clic real sobre la
  // primera fila de la lista, nunca de un id fijo escrito a mano (que podria
  // dejar de existir segun los datos del entorno). El selector busca una
  // `Card` (`data-slot="card"`, ui/card.tsx:12) con `cursor-pointer` dentro
  // del cuerpo de PageShell (`data-slot="page-shell-content"`): el boton
  // movil "Anadir" de /staff tambien lleva `cursor-pointer` (heredado de la
  // clase base de Button) y precede a la lista en el DOM, asi que un
  // selector menos especifico pulsaria el boton en vez de la primera fila.
  const FILA_SELECTOR =
    '[data-slot="page-shell-content"] [data-slot="card"].cursor-pointer'

  await page.setViewportSize(MOBILE)
  await page.goto("/clients")
  await expect(
    page.getByText(PANTALLAS.find((p) => p.nombre === "clients")!.ancla).first()
  ).toBeVisible({ timeout: 30_000 })
  await page.locator(FILA_SELECTOR).first().click()
  await page.waitForURL(/\/clients\/.+/, { timeout: 15_000 })
  const clientesDetalle = PANTALLAS.find((p) => p.nombre === "clients-detalle")!
  await expect(page.getByText(clientesDetalle.ancla).first()).toBeVisible({ timeout: 30_000 })
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: path.join(OUT, "clients-detalle-390-construido.png") })

  await page.setViewportSize(MOBILE)
  await page.goto("/staff")
  await expect(
    page.getByText(PANTALLAS.find((p) => p.nombre === "staff")!.ancla).first()
  ).toBeVisible({ timeout: 30_000 })
  await page.locator(FILA_SELECTOR).first().click()
  await page.waitForURL(/\/staff\/.+/, { timeout: 15_000 })
  const staffDetalle = PANTALLAS.find((p) => p.nombre === "staff-detalle")!
  await expect(page.getByText(staffDetalle.ancla).first()).toBeVisible({ timeout: 30_000 })
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: path.join(OUT, "staff-detalle-390-construido.png") })

  // 3) /staff, /today, /clients y /settings a 1024 y 1440.
  //
  // EL MATIZ DE ESTE BLOQUE: `useMediaQuery` (use-media-query.ts) devuelve
  // `false` en el primer render -- no hay `window` en el render de servidor,
  // asi que en escritorio se pinta primero el arbol MOVIL y luego se cambia
  // al de escritorio. Una fila de empleado/cliente existe en los dos arboles,
  // asi que esperar solo por el ancla de contenido puede capturar el chasis
  // movil a 1440px. Aqui la barra lateral NO es chasis heredado que haya que
  // ignorar (regla general del repo): es justo lo que este bloque construye,
  // asi que se espera por las DOS cosas -- el contenido real y `<aside>`
  // (AppSidebar, app-sidebar.tsx:27).
  for (const nombre of ["today", "staff", "clients", "settings"] as const) {
    const p = PANTALLAS.find((x) => x.nombre === nombre)!
    for (const vp of [DESKTOP_1024, DESKTOP_1440]) {
      await page.setViewportSize(vp)
      await page.goto(p.ruta!)
      await expect(page.locator("aside")).toBeVisible({ timeout: 30_000 })
      await expect(page.getByText(p.ancla).first()).toBeVisible({ timeout: 30_000 })
      await page.evaluate(() => document.fonts.ready)
      await page.screenshot({
        path: path.join(OUT, `${nombre}-${vp.width}-construido.png`),
      })
    }
  }

  // 4) Deuda conocida -- NO documentan un exito, documentan lo que hereda el
  // bloque siguiente. Mismo matiz de espera que el punto 3: tambien se monta
  // dentro de AppLayout, asi que sufre la misma carrera arbol-movil-primero.

  // `/appointments/new` no usa PageShell (tiene su propia cabecera de 68px,
  // ver appointments/new/page.tsx:29-46), asi que a 1440 sale con la barra
  // lateral del chasis pero SIN el ancho maximo de 1084px que si aplica
  // PageShell -- construirla es del bloque del asistente de citas, no de
  // este. El ancla es el primer paso del asistente (EmployeeStep).
  await page.setViewportSize(MOBILE)
  await page.goto("/appointments/new")
  await expect(page.getByText(/elige un profesional/i).first()).toBeVisible({
    timeout: 30_000,
  })
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: path.join(OUT, "appointments-new-390-construido.png") })

  await page.setViewportSize(DESKTOP_1440)
  await page.goto("/appointments/new")
  await expect(page.locator("aside")).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText(/elige un profesional/i).first()).toBeVisible({
    timeout: 30_000,
  })
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: path.join(OUT, "appointments-new-1440-construido.png") })

  // `/calendar` a 1440: `day-view.tsx:21` usa `h-[calc(100vh-16rem)]`,
  // pensado para el chasis movil (cabecera de 56px + barra inferior fija);
  // en escritorio no existe ninguna de las dos, asi que el calculo queda mal
  // dimensionado. Arreglarlo es del bloque 3 (calendario).
  await page.setViewportSize(DESKTOP_1440)
  await page.goto("/calendar")
  await expect(page.locator("aside")).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText(/08:00/).first()).toBeVisible({ timeout: 30_000 })
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: path.join(OUT, "calendar-1440-construido.png") })
})
