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

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const isDesktop = useMediaQuery("(min-width: 1024px)")
  const showFab = !isDesktop && FAB_ROUTES.some((r) => pathname.startsWith(r))
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
  // report `false`). That wiped in-progress form state and reset the
  // `/appointments/new` wizard on resize. Keeping one shared tree with the
  // sidebar/bottom-nav/FAB as optional siblings around a stable `<main>`
  // lets React reconcile `<main>` (and `children`) across the switch instead.
  return (
    <OnboardingGate>
      <div
        className={cn("flex min-h-dvh", !isDesktop && "flex-col")}
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
