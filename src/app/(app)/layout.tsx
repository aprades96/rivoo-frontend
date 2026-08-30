"use client"

import { usePathname } from "next/navigation"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { BottomNav } from "@/components/layout/bottom-nav"
import { FabButton } from "@/components/layout/fab-button"
import { OnboardingGate } from "@/components/layout/onboarding-gate"
import { useMediaQuery } from "@/hooks/use-media-query"
import { useSwipeNavigation } from "@/hooks/use-swipe-navigation"
import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

const FAB_ROUTES = ["/today", "/calendar"]

/**
 * Rutas de rejilla: las que piden a `PageShell` `layout="fill"` (cuerpo sin
 * padding exterior, a alto completo y con scroll DENTRO de si mismo).
 *
 * INVARIANTE: una ruta de `FILL_ROUTES` pasa `layout="fill"` a su `PageShell`,
 * y al reves. Las dos mitades son necesarias y ninguna sirve sola:
 *  - la ruta aqui y sin `fill` en la pantalla = la pagina deja de hacer scroll
 *    (`overflow-hidden` de abajo) y el contenido que pase de 100dvh es
 *    inalcanzable;
 *  - `fill` en la pantalla y la ruta no aqui = el contenedor sigue siendo
 *    `min-h-dvh`, o sea alto AUTOMATICO, y una altura no definida no acota
 *    nada: la cadena `flex-1 min-h-0` de `PageShell` se estira con el
 *    contenido en vez de acotarlo, y quien hace scroll vuelve a ser la pagina.
 * Quien anada la siguiente pantalla de rejilla tiene que tocar los dos sitios.
 */
const FILL_ROUTES = ["/calendar"]

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const isDesktop = useMediaQuery("(min-width: 1024px)")
  const showFab = !isDesktop && FAB_ROUTES.some((r) => pathname.startsWith(r))
  // Sin `!isDesktop`, a diferencia de `showFab`: la altura definida hace falta
  // en los DOS anchos (`CalendarioDesktop.dc.html:130` y `Calendario.dc.html:66`
  // dibujan los dos su marco con `overflow: hidden`).
  const isFill = FILL_ROUTES.some((r) => pathname.startsWith(r))
  const { onTouchStart, onTouchEnd } = useSwipeNavigation()

  // Desktop chassis: `design/EquipoDesktop.dc.html` -- fixed sidebar plus a
  // full-width main, no `AppHeader` (each screen paints its own top bar via
  // `PageShell`), no `BottomNav`/swipe (there is no bottom tab bar to swipe
  // between), and no `pb-20` (that gap only exists to clear the fixed bottom
  // nav). No FAB either: no desktop artboard draws a floating button, and its
  // `bottom-20` exists only to clear the mobile bottom nav that isn't here --
  // `/today` and `/calendar` get their "Nueva cita" CTA in the top bar instead.
  //
  // `{children}` sits in the SAME position (`<main>`, second slot) on both
  // branches below, single return, no separate `if`: two sibling branches
  // with different types at index 0 (`<main>` vs `<AppSidebar>`) made React
  // unmount/remount all of `children` on every breakpoint crossing, which
  // `use-media-query.ts` forces once per desktop load (SSR/first paint always
  // report `false`). That wiped in-progress form state on any grid/form
  // screen still in this route group -- `/appointments/new` used to be the
  // textbook example, but it has since moved to `(fullscreen)`, where
  // `NewAppointmentShell` pays the same invariant on its own
  // (`new-appointment-shell.tsx`). Keeping one shared tree with the
  // sidebar/bottom-nav/FAB as optional siblings around a stable `<main>`
  // lets React reconcile `<main>` (and `children`) across the switch instead.
  return (
    <OnboardingGate>
      <div
        className={cn(
          "flex",
          // `h-dvh` (definida), no `min-h-dvh` (un suelo, alto automatico): sin
          // una altura DEFINIDA arriba, el `flex-1 min-h-0` de `PageShell` no
          // acota nada -- el tamano intrinseco del contenedor sigue incluyendo
          // la aportacion del contenido, asi que la rejilla crece a su alto
          // natural y el scroll se lo queda la pagina. Con `h-dvh`:
          //  - escritorio: contenedor flex en FILA, asi que `<main>` se estira
          //    a esos 100dvh y la cadena de alturas ya baja desde ahi;
          //  - movil: contenedor en columna, y `BottomNav` es `fixed` (no
          //    consume espacio de flex), asi que `<main>` recibe los 100dvh
          //    enteros y su `pb-20` deja el contenido justo encima de la barra.
          // `overflow-hidden` es lo que dibujan los dos artboards a nivel de
          // marco: en una ruta de rejilla la pagina NO hace scroll, lo hace la
          // rejilla por dentro.
          isFill ? "h-dvh overflow-hidden" : "min-h-dvh",
          !isDesktop && "flex-col"
        )}
        onTouchStart={isDesktop ? undefined : onTouchStart}
        onTouchEnd={isDesktop ? undefined : onTouchEnd}
      >
        {isDesktop && <AppSidebar />}
        <main
          className={
            isDesktop
              ? "flex min-w-0 flex-1 flex-col"
              : // `max-w-3xl` vive en `PageShell` (contenido), no aqui: la
                // cabecera movil necesita el ancho completo de `<main>` entre
                // 768 y 1023px, y este `<main>` es su ancestro.
                //
                // `flex flex-col min-h-0` (antes era un bloque a secas): el
                // hijo unico es el `flex flex-1 flex-col` de `PageShell`, y
                // dentro de un bloque su `flex-1` es inerte y su altura queda
                // en `auto`. Como columna flex el `flex-1` vuelve a valer, y
                // `min-h-0` levanta el minimo automatico para que un hijo con
                // `flex-1 min-h-0` (`PageShell layout="fill"`) pueda encogerse
                // y hacer scroll DENTRO de si mismo en vez de estirar la
                // pagina. Las once pantallas sin `fill` no cambian: el shell
                // de arriba es `min-h-dvh` con alto automatico, asi que sigue
                // creciendo con el contenido y el scroll de pagina es el de
                // siempre -- `pb-20` incluido, que sigue despejando la
                // `BottomNav` fija al final del contenido.
                "flex w-full min-h-0 flex-1 flex-col pb-20"
          }
        >
          {children}
        </main>
        {showFab && <FabButton />}
        {!isDesktop && <BottomNav />}
      </div>
    </OnboardingGate>
  )
}
