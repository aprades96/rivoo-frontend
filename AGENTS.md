<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Tests driven by React Query can pass without testing anything

A test that seeds/pushes data into the query cache and then asserts **synchronously**
passes regardless of the code under test. `notifyManager` schedules observer
notification on a **macrotask** (`systemSetTimeoutZero` in
`node_modules/@tanstack/query-core/src/notifyManager.ts`), so the component never
re-renders before the assertion. `await act(async () => {})` drains microtasks only
and provably cannot flush it — it produces the same false green.

This has already happened here: a regression test written in the ordinary shape passed
with the bug fully reintroduced. It was caught only by mutating the source and finding
the test still green.

**Rule:** in any test that simulates a refetch, first `await findBy*` on something the
component under test does **not** own, to prove the data landed. Only then assert on the
value you care about. Prefer driving the component through props or a mocked hook when
you can — those are synchronous and immune.

Also: pushing a deeply-equal payload proves nothing either. `structuralSharing` is on by
default, so an equal payload hands back the *same* object and an identity bug never fires.
Change a field.

# Every test runs as MOBILE unless it says otherwise

`src/test/setup.ts` polyfills `matchMedia` returning `matches: false` **always**. Since
this repo decides width differences by conditional mounting in JS (never `hidden lg:*`),
that default means **a test that does not call `mockMatchMedia(true)` exercises the mobile
branch only** — and the desktop branch is not covered at all.

This has already happened here: on the "Hoy" screen, four desktop-only pieces could be
deleted — including a card that exists **only** on desktop — with all 1009 tests still
green. The suite looked healthy and half the screen was untested.

**Rule:** when a component branches on width, count coverage **per branch**, not per file.
Every desktop assertion needs its own `mockMatchMedia(true)` **and** an `afterEach` that
restores it. The only trustworthy check is to mutate the branch and confirm a test falls.

# A Tailwind v4 token missing from `@theme inline` vanishes without a word

Declaring `--foo: #hex` in `:root` is **not enough**. If it is not also mapped in the
`@theme inline` block of `src/app/globals.css`, the utility (`bg-foo`) is never generated:
no build error, no warning, no console message — just an element with no background.

**Rule:** every new token goes in **both** places, and the check is to grep the generated
CSS in `.next/` for the class, not to eyeball the declaration.

# `tailwind-merge` silently deletes a `leading-*` written before a `text-[Npx]`

Measured in this repo: `twMerge("text-sm leading-tight font-semibold text-[15px]")` returns
`"font-semibold text-[15px]"` — the `leading-tight` is gone. It treats them as the same
group, and the arbitrary font size wins the whole pair.

This compounds with Tailwind's preflight, which imposes `line-height: 1.5` while the
artboards declare none (~1.25): **every `text-[Npx]` needs its own explicit `leading-*`,
written AFTER it.**

# `vitest.config.ts` pins `TZ` on purpose — do not remove it

Without the pin, tests run in the runner's zone. Any assertion about date-range conversion
then **passes in CI (UTC) with the implementation broken**, because a UTC-fixed offset and
a local-midnight conversion agree when local == UTC.

This has already happened here: mutating the conversion to a fixed `Z` offset failed on a
Madrid machine and passed clean under `TZ=UTC` — in the one file guarding the fix that a
whole block existed to deliver.

# El primitivo `Card` no tiene borde: fija el color y sale de ancho cero

`src/components/ui/card.tsx` fuerza `gap-4 rounded-xl py-4 ring-1 ring-foreground/10`
y **no incluye ninguna clase `border`**. Escribir `border-warning-border` o
`border-border` solo fija el COLOR: sin la utilidad `border`, el ancho sigue siendo
`0` y el borde no se pinta. Lo que se ve es el `ring` gris, que no es el borde que
pide ningun artboard.

Y una clase de borde tampoco quita el `ring`: son grupos distintos de
tailwind-merge.

Esto ya paso aqui: en el bloque 6 los **cuatro** paneles de la ficha de cliente
—perfil, dos KPIs y el bloque GDPR— salieron sin su borde. La trampa estaba
escrita en el plan, en la seccion que los implementadores tenian orden de leer, y
cayeron igual. Solo la caza comparar contra el artboard.

**Regla:** con `Card`, escribe `border` **y** el color. Y si el diseno no pide
`ring`, quitalo explicitamente.

# Un `vi.fn()` que se monta y nunca se afirma no prueba nada — y el test de la capa de API tampoco lo salva

Patron que dejo un fallo **en produccion durante meses** con su fichero de test en
verde: `staff/[id]/page.tsx` mandaba `{ serviceIds }` a un endpoint que exige
`{ services: [{ serviceId }] }`, asi que "Guardar servicios" devolvia **400**.

Habia dos redes, y ninguna servia:

1. En el test de la pantalla, `assignServices` era un `vi.fn()` reseteado en
   `beforeEach` y **jamas afirmado**: nadie pulsaba el boton ni miraba el payload.
2. El test de la capa de API **si** afirma el contrato, pero llama a
   `staffApi.assignServices(id, { services: [{ serviceId }] }, token)` — **escribe
   el cuerpo correcto a mano**. No puede detectar que la PANTALLA construya uno
   malo.

Se arreglo el bug, y una campana de mutacion demostro despues que **se podia
reintroducir sin que cayera un solo test**.

**Regla:** si una pantalla construye un payload, el test de la pantalla tiene que
**ejecutar la accion desde la UI** y afirmar el payload REAL que recibio el doble.
Afirmar el contrato en la capa de API es necesario y **no** es suficiente: cubre
la funcion, no a su llamante.

# La cobertura de escritorio puede afirmar el marco y no el contenido

Variante peor de la trampa del ancho: la rama de escritorio **si** tiene test, y
aun asi no protege nada.

Paso en la ficha de empleado: el test se llamaba "lays out three fixed-width
cards" y afirmaba los ROTULOS (`"Horario semanal"`, `"Servicios que realiza"`) mas
la ausencia de `tablist`. Los rotulos son **hermanos** del contenido, no lo
contienen: se podia vaciar la tarjeta del horario semanal entera —dejar el editor
fuera de la pantalla— y el test seguia verde. Tampoco afirmaba ningun ancho, pese
al nombre.

**Regla:** afirma el CONTENIDO de cada region (los `switch`, el CTA, las filas),
no su encabezado. Y comprueba mutando: vacia la region y mira si algo cae.
