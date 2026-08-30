import { test, expect } from "@playwright/test"
import path from "node:path"
import fs from "node:fs"

/**
 * Captura, a la misma anchura, el artboard del diseno y la pantalla
 * construida, para las seis pantallas de Equipo y Clientes (bloque 6), en
 * movil (390) y en escritorio (1440).
 *
 * No compara pixeles automaticamente, mismo motivo que
 * `visual/shell-vs-artboards.spec.ts`: un umbral numerico sobre dos
 * renderizados que nunca seran identicos (fuentes, antialiasing) da falsos
 * rojos y falsos verdes por igual. Produce el par de imagenes para que las
 * mire una persona.
 *
 * QUE MIRAR, pantalla por pantalla -- sacado de §1.3 a §1.8 de
 * `rivoo/docs/specs/equipo-y-clientes/IMPLEMENTATION_PLAN.md`. Leer esto
 * ANTES de abrir las imagenes, no como referencia rapida sino como lista de
 * comprobacion:
 *
 * ------------------------------------------------------------------------
 * 1) EQUIPO (lista) -- `/staff` -- `Equipo` / `EquipoDesktop`
 * ------------------------------------------------------------------------
 *  - MOVIL: cabecera 56px con titulo `.display` 21px; segmentado
 *    Empleados/Servicios (pildora, opcion activa 32px con fondo blanco y
 *    sombra); contador "N empleados" 13px; CTA "Anadir" 38px con icono
 *    plus 16px; filas de 12px de padding con avatar 40x40, nombre 14px/600,
 *    puesto 12px, badge de estado (Activo: fondo `--color-status-completed-bg`;
 *    Inactivo: borde+fondo blanco+texto atenuado, SIN cambiar el fondo de
 *    la fila entera); pie de ayuda 11px.
 *  - ESCRITORIO: topbar 72px, CTA "Anadir empleado"; barra de filtros con
 *    segmentado + contador ("N empleados · N activos" SOLO cuando el
 *    desglose es exacto, ver `staff/page.tsx` `employeesCounterText`);
 *    TABLA de 6 columnas (Empleado, Puesto 170px, Contacto, Color 128px,
 *    Estado 96px, chevron 20px), cabecera 44px `bg #F8F2EA` en mayusculas;
 *    fila inactiva con fondo `--muted-subtle`, "Sin telefono"/"Por defecto"
 *    en vez de dato ausente; separadores a sangre completa salvo tras la
 *    ultima fila; SIN hover dibujado en ningun artboard.
 *
 * ------------------------------------------------------------------------
 * 2) FICHA DE EMPLEADO -- `/staff/[id]` -- `DetalleEmpleado` / `DetalleEmpleadoDesktop`
 * ------------------------------------------------------------------------
 *  - MOVIL: cabecera con atras (chevron 20px) y titulo generico "Detalle
 *    empleado" (15px, SIN `.display`); identidad con avatar 56x56, nombre
 *    17px/600, badge; dos `.iconbtn` de 36x36 SIN etiqueta de texto
 *    (editar=pencil, borrar=trash); contacto e info de color; segmentado
 *    Horarios/Servicios (el panel "Servicios" NO esta dibujado en movil);
 *    filas de dia con toggle 42x24, domingo cerrado con fila `bg #FAF6F0`
 *    y sin campos de hora.
 *  - ESCRITORIO: topbar con atras en caja 38x38; TRES tarjetas en fila
 *    (perfil 300px, horario 386px, servicios 372px) -- NO hay segmentado,
 *    los servicios son una tercera tarjeta; domingo recien activado con
 *    aviso propio; CTAs "Guardar horarios" / "Guardar servicios (N)".
 *  - AVISO ESPERADO PROPIO DE ESTA PANTALLA (ver mas abajo, no es un
 *    fallo): las tres tarjetas suman 300+24+386+24+372 = 1106px, mas ancho
 *    que el `max-w-[1084px]` que trae `PageShell` para las otras once
 *    rutas del repo -- por eso esta es la UNICA pantalla del bloque con
 *    `contentClassName="max-w-[1106px]"` propio (`staff/[id]/page.tsx:231`).
 *
 * ------------------------------------------------------------------------
 * 3) FORMULARIO DE EMPLEADO -- hoja/modal -- `FormularioEmpleado` / `FormularioEmpleadoDesktop`
 * ------------------------------------------------------------------------
 *  - El artboard MOVIL dibuja un ALTA ("Nuevo empleado": bloque de "Crear
 *    cuenta de acceso" + contrasena temporal) y el de ESCRITORIO una
 *    EDICION ("Editar empleado": sin el bloque de cuenta, con nota final).
 *    No son dos anchos de la misma captura de pantalla: son los dos modos
 *    del mismo formulario (§1.5, D17). Por eso esta suite abre el alta en
 *    movil (boton "Anadir" de `/staff`) y la edicion en escritorio (boton
 *    "Editar" de la ficha de empleado).
 *  - MOVIL: hoja inferior, radio `16 16 0 0`, SIN borde, grabber 36x4;
 *    cerrar 32x32 SIN borde ni fondo, `X` 18px; campos en grid de 2
 *    columnas; divisor `#E7DCCF` (no `#EFE6DA`) antes del bloque de cuenta.
 *  - ESCRITORIO: modal centrado de 512px, radio 12px, SIN grabber; cerrar
 *    32x32 CON borde y fondo blanco.
 *
 * ------------------------------------------------------------------------
 * 4) CLIENTES (lista) -- `/clients` -- `Clientes` / `ClientesDesktop`
 * ------------------------------------------------------------------------
 *  - MOVIL: cabecera 56px; CTA "Anadir"; buscador con icono a la
 *    izquierda; contador "N clientes" (12px, SIN `.num`); filas SIN
 *    chevron, con bloque de visitas a la derecha (numero 20px + etiqueta
 *    "visitas" 10px); subtitulo de contacto en una sola linea
 *    (telefono · email), "Sin contacto" cuando no hay ninguno.
 *  - ESCRITORIO: topbar con CTA "Anadir cliente"; toolbar con buscador de
 *    340px + contador; TABLA de 5 columnas (Cliente, Contacto, Ultima
 *    visita 150px, Visitas 96px alineado a la derecha, chevron 20px); linea
 *    de "Mostrando N de M..." FUERA de la tarjeta, sin controles de
 *    paginacion ni de orden ni de filtro (ningun artboard los dibuja).
 *
 * ------------------------------------------------------------------------
 * 5) FICHA DE CLIENTE -- `/clients/[id]` -- `DetalleCliente` / `DetalleClienteDesktop`
 * ------------------------------------------------------------------------
 *  - MOVIL: cabecera con titulo generico "Detalle cliente" (NO el nombre);
 *    identidad con avatar 56x56 y "Cliente desde <fecha>"; DOS KPIs
 *    (Visitas, Ultima visita) en grid 2 columnas; grupo de contacto con
 *    boton "Llamar" (solo movil); notas; HISTORIAL de citas (solo 3 de las
 *    citas totales, sin via para ver el resto); bloque GDPR con
 *    "Exportar datos" / "Anonimizar".
 *  - ESCRITORIO: topbar con el NOMBRE del cliente como titulo (no
 *    generico) + "Cliente desde..." en la misma linea; columna izquierda
 *    fija (400px) con tarjeta de perfil (badge "Reserva online", SIN boton
 *    Llamar) y KPIs; columna derecha con TABLA de historial completa
 *    (Fecha, Servicio, Profesional, Importe, Estado) y footer
 *    "Mostrando N de M citas · Ver todas".
 *  - MIRAR CON LUPA A 390px (D21): el KPI "Ultima visita" dibuja en el
 *    artboard `05/08/2026` a 21px en una tarjeta de ~151px utiles; el
 *    codigo pinta `12 ago 2026` (formato unificado, ver aviso 2 mas abajo),
 *    que a 21px mide ~121px. ENTRA, pero de un margen estrecho: el segundo
 *    test de este fichero mide el ancho real del texto contra el ancho util
 *    de la tarjeta y falla si no entra. Si algun dia desborda, la
 *    correccion es BAJAR EL TAMANO DEL KPI, nunca volver a `dd/mm/yyyy`.
 *
 * ------------------------------------------------------------------------
 * 6) FORMULARIO DE CLIENTE -- hoja/modal -- `FormularioCliente` / `FormularioClienteDesktop`
 * ------------------------------------------------------------------------
 *  - Los dos anchos dibujan datos REALES en los campos (a diferencia del
 *    formulario de empleado, aqui no hay contraste alta/edicion en el
 *    contenido de los campos) -- pero el titulo si cambia: "Nuevo cliente"
 *    en movil (via "Anadir" en `/clients`), "Editar cliente" en escritorio
 *    (via "Editar" en la ficha de cliente).
 *  - MOVIL: hoja, cerrar 32x32 CON borde y fondo, `X` 15px.
 *  - ESCRITORIO: modal, radio artboard `16 16 12 12` (ver aviso 3), scrim
 *    que tapa tambien la barra lateral.
 *  - Ni un boton "Cancelar" ni ningun estado de error/validacion estan
 *    dibujados en ninguno de los doce artboards.
 *
 * ------------------------------------------------------------------------
 * AVISOS ESPERADOS -- son deuda o decision ya tomada, NO fallos de esta
 * pantalla ni regresiones. Si algo de esta lista aparece en las capturas,
 * NO abrir una incidencia:
 * ------------------------------------------------------------------------
 *
 *  1. `max-w-[1084px]` de `page-shell.tsx:131` frente a los 1136px que
 *     dibuja el artboard a 1440 -- deuda comun a las doce rutas del chasis,
 *     no se toco en este bloque. Y aqui YA MUERDE: las tres tarjetas de la
 *     ficha de empleado suman 1106px (300+24+386+24+372), asi que esa
 *     pantalla lleva su propio `contentClassName="max-w-[1106px]"`
 *     (`staff/[id]/page.tsx:231`) -- es la UNICA de las seis que se sale
 *     del carril de 1084px, a proposito.
 *  2. Las fechas: el canvas usa dos formatos para el mismo dato (`12 ago
 *     2026` en la tabla de clientes, `05/08/2026` en la ficha). El bloque
 *     unifica A PROPOSITO en `formatDate` (`d MMM yyyy`, `src/lib/utils/dates.ts:17`)
 *     en todas partes. Ver tambien el punto "mirar con lupa" de la ficha de
 *     cliente arriba.
 *  3. El radio del modal de cliente: el artboard dibuja `16 16 12 12`
 *     (`FormularioClienteDesktop.dc.html:170`), el codigo usa un unico
 *     `rounded-xl` (12px) en `ResponsiveFormModal` para los dos modales
 *     (empleado y cliente) -- desviacion de aparicion unica, tratada como
 *     desliz de dibujo, no como contrato a seguir.
 *  4. El scrim: los artboards dan 0.42 (tres apariciones) y 0.34 (una
 *     sola, en `FormularioEmpleadoDesktop.dc.html:297`); el codigo unifica
 *     a 0.42 en los dos modales (`SCRIM_CLASS` en
 *     `responsive-form-modal.tsx`).
 *  5. El icono `X` del boton de cerrar: `FormularioEmpleadoDesktop.dc.html:304`
 *     dibuja 16px; el codigo usa 15px en el modal de empleado, que es lo
 *     que dibujan los otros tres artboards de formulario (unica aparicion
 *     distinta, mismo criterio que el punto 3).
 *  6. El texto va CON tildes (`Anadir`, `Telefono`, `Ultima visita` se
 *     escriben `Añadir`, `Teléfono`, `Última visita` en el codigo),
 *     mientras los doce artboards lo escriben sin ellas. Decision del
 *     bloque: los artboards no son la autoridad ortografica.
 *  7. Las columnas "Visitas" y "Ultima visita" de la LISTA de clientes
 *     saldran vacias (`0` y `—`) en un salon con historial anterior al
 *     despliegue, porque `totalVisits`/`lastVisitAt` no tienen backfill
 *     (§1.10). La FICHA de cliente si da cifras reales porque las deriva
 *     del historial de citas (`summary.completedCount`/`lastCompletedAt`,
 *     D36), no de esos dos campos muertos. No es un fallo: es lo decidido.
 *
 * Requisitos: la pila levantada (Keycloak, gateway, staff-service,
 * client-service, appointment-service) y `npm run dev`.
 *
 * PRECONDICION: el salon del usuario de prueba debe tener
 * `onboarding_completed_at` NO nulo (si no, `OnboardingGate` redirige a
 * `/welcome`, mismo matiz que `shell-vs-artboards.spec.ts:57-60`), y debe
 * tener AL MENOS un empleado y un cliente con historial de citas -- si no
 * los hay, las fichas de detalle no son alcanzables por el selector de
 * primera fila usado mas abajo.
 *
 * NO EJECUTAR SIN LA PILA Y LAS CREDENCIALES. Esta suite no se ha corrido:
 * ni Keycloak ni el gateway estan disponibles en este entorno, y las
 * credenciales viajan por variable de entorno, nunca por chat ni por el
 * repo. Comando exacto para cuando si esten disponibles:
 *
 *   RIVOO_E2E_EMAIL=... RIVOO_E2E_PASSWORD=... npx playwright test visual/equipo-clientes.spec.ts
 *
 * Variables: RIVOO_E2E_EMAIL, RIVOO_E2E_PASSWORD.
 */

const OUT = path.resolve("../rivoo/docs/specs/equipo-y-clientes/verificacion")

const MOBILE = { width: 390, height: 844 }
const DESKTOP_1440 = { width: 1440, height: 900 }

interface Pantalla {
  nombre: string
  artboardMovil: string
  artboardDesktop: string
}

/** Las seis pantallas del bloque, cada una con su par de artboards fijos (390x844 / 1440x900). */
const PANTALLAS: Pantalla[] = [
  { nombre: "staff", artboardMovil: "Equipo", artboardDesktop: "EquipoDesktop" },
  {
    nombre: "staff-detalle",
    artboardMovil: "DetalleEmpleado",
    artboardDesktop: "DetalleEmpleadoDesktop",
  },
  {
    nombre: "staff-formulario",
    artboardMovil: "FormularioEmpleado",
    artboardDesktop: "FormularioEmpleadoDesktop",
  },
  { nombre: "clients", artboardMovil: "Clientes", artboardDesktop: "ClientesDesktop" },
  {
    nombre: "clients-detalle",
    artboardMovil: "DetalleCliente",
    artboardDesktop: "DetalleClienteDesktop",
  },
  {
    nombre: "clients-formulario",
    artboardMovil: "FormularioCliente",
    artboardDesktop: "FormularioClienteDesktop",
  },
]

test.beforeAll(() => {
  fs.mkdirSync(OUT, { recursive: true })
})

test("captura los artboards del diseno", async ({ page }) => {
  for (const p of PANTALLAS) {
    const ficheroMovil = path.resolve(`design/${p.artboardMovil}.dc.html`)
    expect(fs.existsSync(ficheroMovil), `falta el artboard ${ficheroMovil}`).toBe(true)

    await page.setViewportSize(MOBILE)
    await page.goto(`file://${ficheroMovil}`)
    // Las fuentes vienen de Google Fonts; sin esto se captura el fallback.
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({ path: path.join(OUT, `${p.nombre}-390-diseno.png`) })

    const ficheroDesktop = path.resolve(`design/${p.artboardDesktop}.dc.html`)
    expect(fs.existsSync(ficheroDesktop), `falta el artboard ${ficheroDesktop}`).toBe(true)

    await page.setViewportSize(DESKTOP_1440)
    await page.goto(`file://${ficheroDesktop}`)
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({ path: path.join(OUT, `${p.nombre}-1440-diseno.png`) })
  }
})

test("captura las pantallas construidas", async ({ page }) => {
  const email = process.env.RIVOO_E2E_EMAIL
  const password = process.env.RIVOO_E2E_PASSWORD
  expect(email, "falta RIVOO_E2E_EMAIL").toBeTruthy()
  expect(password, "falta RIVOO_E2E_PASSWORD").toBeTruthy()

  // El login de la app NO es un formulario: es una pantalla con un boton que
  // entrega a Keycloak. Mismo enfoque que `shell-vs-artboards.spec.ts:225-249`,
  // apuntando a `/staff` porque es la primera ruta de este bloque.
  await page.setViewportSize(MOBILE)
  await page.goto("/staff")
  await page.waitForURL(/\/login|localhost:9080/, { timeout: 60_000 })

  if (!page.url().includes("9080")) {
    await page.getByRole("button", { name: /iniciar sesion/i }).click()
    await page.waitForURL(/localhost:9080/, { timeout: 60_000 })
  }

  await page.fill("#username", email!)
  await page.fill("#password", password!)
  await page.click("#kc-login")
  await page.waitForURL(/localhost:3000/, { timeout: 60_000 })

  // Selectores de fila: las dos tablas/listas usan `<Link>` como fila
  // entera (`data-table.tsx:93`, `employee-card.tsx`, `client-card.tsx`),
  // asi que un `a[href^="/staff/"]` o `a[href^="/clients/"]` apunta siempre
  // a la primera fila real, en movil (tarjeta) o en escritorio (tabla), sin
  // depender de que exista `data-slot="card"` como en el bloque anterior.
  const PRIMERA_FILA_STAFF = 'a[href^="/staff/"]'
  const PRIMERA_FILA_CLIENTS = 'a[href^="/clients/"]'

  // ==========================================================================
  // 1) MOVIL (390) -- las seis pantallas
  // ==========================================================================
  await page.setViewportSize(MOBILE)

  await page.goto("/staff")
  await expect(page.getByText(/\d+ empleados?/i).first()).toBeVisible({ timeout: 30_000 })
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: path.join(OUT, "staff-390-construido.png") })

  await page.locator(PRIMERA_FILA_STAFF).first().click()
  await page.waitForURL(/\/staff\/.+/, { timeout: 15_000 })
  await expect(page.getByText(/activo|inactivo/i).first()).toBeVisible({ timeout: 30_000 })
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: path.join(OUT, "staff-detalle-390-construido.png") })

  // Formulario de empleado en movil = ALTA (D17): se abre desde el boton
  // "Anadir" de la lista, no desde "Editar" de la ficha.
  await page.goto("/staff")
  await expect(page.getByText(/\d+ empleados?/i).first()).toBeVisible({ timeout: 30_000 })
  await page.getByRole("button", { name: /^añadir$/i }).click()
  await expect(page.getByText(/nuevo empleado/i).first()).toBeVisible({ timeout: 15_000 })
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: path.join(OUT, "staff-formulario-390-construido.png") })
  await page.keyboard.press("Escape")

  await page.goto("/clients")
  await expect(page.getByText(/\d+ clientes?/i).first()).toBeVisible({ timeout: 30_000 })
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: path.join(OUT, "clients-390-construido.png") })

  await page.locator(PRIMERA_FILA_CLIENTS).first().click()
  await page.waitForURL(/\/clients\/.+/, { timeout: 15_000 })
  await expect(page.getByText(/visitas/i).first()).toBeVisible({ timeout: 30_000 })
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: path.join(OUT, "clients-detalle-390-construido.png") })

  // EL PUNTO DE LUPA (D21): el valor del KPI "Ultima visita" tiene que caber
  // en el ancho util de su tarjeta a 390px. No se compara contra un numero
  // fijo -- se mide el elemento y el de su tarjeta contenedora, para que
  // este test siga siendo valido si cambia el padding en el futuro.
  const kpiValor = page.getByText(/^\d{1,2} \w{3}\.? \d{4}$|^—$/).last()
  await expect(kpiValor).toBeVisible()
  const kpiBox = await kpiValor.boundingBox()
  const tarjetaBox = await kpiValor
    .locator("xpath=ancestor::*[contains(@class,'gap-0.5')][1]")
    .boundingBox()
  expect(kpiBox, "no se pudo medir el KPI de Ultima visita").not.toBeNull()
  expect(tarjetaBox, "no se pudo medir la tarjeta del KPI").not.toBeNull()
  if (kpiBox && tarjetaBox) {
    expect(
      kpiBox.x + kpiBox.width,
      `el KPI 'Ultima visita' desborda su tarjeta a 390px (texto hasta ${kpiBox.x + kpiBox.width}, tarjeta hasta ${tarjetaBox.x + tarjetaBox.width}) -- si esto falla, la salida es BAJAR EL TAMANO DEL KPI, no volver a dd/mm/yyyy`
    ).toBeLessThanOrEqual(tarjetaBox.x + tarjetaBox.width)
  }

  // Formulario de cliente en movil = alta, mismo criterio que empleado.
  await page.goto("/clients")
  await expect(page.getByText(/\d+ clientes?/i).first()).toBeVisible({ timeout: 30_000 })
  await page.getByRole("button", { name: /^añadir$/i }).click()
  await expect(page.getByText(/nuevo cliente/i).first()).toBeVisible({ timeout: 15_000 })
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: path.join(OUT, "clients-formulario-390-construido.png") })
  await page.keyboard.press("Escape")

  // ==========================================================================
  // 2) ESCRITORIO (1440) -- las seis pantallas
  // ==========================================================================
  // Mismo matiz que `shell-vs-artboards.spec.ts:301-309`: `useMediaQuery`
  // devuelve `false` en el primer render (sin `window` en el render de
  // servidor), asi que en escritorio se monta primero el arbol movil y
  // luego el de escritorio. Se espera por `<aside>` ademas de por el
  // contenido real para no capturar el chasis movil a 1440px.
  await page.setViewportSize(DESKTOP_1440)

  await page.goto("/staff")
  await expect(page.locator("aside")).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText(/\d+ empleados?/i).first()).toBeVisible({ timeout: 30_000 })
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: path.join(OUT, "staff-1440-construido.png") })

  await page.locator(PRIMERA_FILA_STAFF).first().click()
  await page.waitForURL(/\/staff\/.+/, { timeout: 15_000 })
  await expect(page.locator("aside")).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText(/activo|inactivo/i).first()).toBeVisible({ timeout: 30_000 })
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: path.join(OUT, "staff-detalle-1440-construido.png") })

  // Formulario de empleado en escritorio = EDICION (D17): se abre desde el
  // boton "Editar" de la ficha en la que ya estamos, nunca desde "Anadir".
  await page.getByRole("button", { name: /^editar$/i }).click()
  await expect(page.getByText(/editar empleado/i).first()).toBeVisible({ timeout: 15_000 })
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: path.join(OUT, "staff-formulario-1440-construido.png") })
  await page.keyboard.press("Escape")

  await page.goto("/clients")
  await expect(page.locator("aside")).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText(/\d+ clientes?/i).first()).toBeVisible({ timeout: 30_000 })
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: path.join(OUT, "clients-1440-construido.png") })

  await page.locator(PRIMERA_FILA_CLIENTS).first().click()
  await page.waitForURL(/\/clients\/.+/, { timeout: 15_000 })
  await expect(page.locator("aside")).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText(/visitas/i).first()).toBeVisible({ timeout: 30_000 })
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: path.join(OUT, "clients-detalle-1440-construido.png") })

  await page.getByRole("button", { name: /^editar$/i }).click()
  await expect(page.getByText(/editar cliente/i).first()).toBeVisible({ timeout: 15_000 })
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: path.join(OUT, "clients-formulario-1440-construido.png") })
  await page.keyboard.press("Escape")
})
