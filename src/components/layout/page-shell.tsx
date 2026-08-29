"use client"

import type { ReactNode } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useMediaQuery } from "@/hooks/use-media-query"
import { cn } from "@/lib/utils"

// Tailwind's `lg:` breakpoint (1024px) -- keep in sync if that ever changes.
const DESKTOP_QUERY = "(min-width: 1024px)"

export interface PageShellProps {
  title: string
  /**
   * Flecha de volver en la cabecera MOVIL. Deliberadamente independiente de
   * `desktopBack`: la flecha es propiedad del breakpoint, no de la pantalla.
   * Las cinco subpaginas de ajustes llevan flecha en movil y no en escritorio
   * porque alli la salida es la subnav lateral de 210px -- fusionar ambas en
   * una sola prop rompe ese caso.
   *
   * `true` hace `router.back()`. Pasar una funcion la sustituye: seis de las
   * siete pantallas con flecha vuelven al historial, pero `staff/[id]` navega
   * a una ruta fija (`router.push("/staff")`), y `router.back()` no sirve ahi.
   */
  back?: boolean | (() => void)
  /**
   * Flecha 38x38 en la barra superior de escritorio. No es booleano porque
   * los dos artboards que la llevan no la dibujan igual: `DetalleCliente`
   * (`plain`) no lleva borde; `DetalleEmpleado` (`bordered`) si, y ademas su
   * titulo lleva `padding-left:8px` que `plain` no lleva.
   *
   * La variante a secas hace `router.back()`; `{ variant, onBack }` sustituye
   * la navegacion por defecto -- mismo motivo que en `back`.
   */
  desktopBack?: "plain" | "bordered" | { variant: "plain" | "bordered"; onBack: () => void }
  /** Cluster de acciones a la derecha, en los DOS anchos. */
  actions?: ReactNode
  /**
   * Sustituye a `actions` por debajo de 1024, no se suma. `null` deja la
   * cabecera movil sin acciones aunque `actions` tenga contenido (caso real:
   * `/staff`, cuyo CTA vive en el cuerpo en movil).
   */
  mobileActions?: ReactNode | null
  /** Columna bajo el titulo, solo escritorio. */
  subtitle?: ReactNode
  /** Inline, pegado al titulo, gap 16px. */
  titleAdjacent?: ReactNode
  titleSize?: "default" | "lg"
  /** Clase de la capa INTERNA del contenido; nunca el padding exterior. */
  contentClassName?: string
  /**
   * `"fill"` entrega el cuerpo SIN padding exterior y a alto completo, para
   * las pantallas de rejilla. `CalendarioDesktop.dc.html:103` pega la fila de
   * empleados a la barra superior sin hueco vertical y le pone su propio
   * `padding: 0 24px`, y `:130` da a la rejilla horaria el alto restante con
   * `overflow` propio -- dos cosas imposibles bajo el `px-7 py-6` (escritorio)
   * / `p-4 md:py-6` (movil) de `"default"`, que `contentClassName` no toca.
   *
   * Con `fill` cada franja de la pantalla trae su propio espaciado y la cadena
   * de alturas (`flex-1 min-h-0` en las dos capas) llega hasta el hijo, que asi
   * puede hacer scroll DENTRO de si mismo en vez de estirar la pagina.
   *
   * `"default"` deja intactas las otras once pantallas: mismo arbol, mismas
   * clases, salvo el `min-h-0` del contenedor raiz.
   */
  layout?: "default" | "fill"
  children: ReactNode
}

export function PageShell({
  title,
  back = false,
  desktopBack,
  actions,
  mobileActions,
  subtitle,
  titleAdjacent,
  titleSize = "default",
  contentClassName,
  layout = "default",
  children,
}: PageShellProps) {
  const isDesktop = useMediaQuery(DESKTOP_QUERY)
  const router = useRouter()

  const desktopBackResolved =
    desktopBack === undefined
      ? undefined
      : typeof desktopBack === "string"
        ? { variant: desktopBack, onBack: () => router.back() }
        : desktopBack

  const mobileBackResolved =
    back === false || back === undefined
      ? undefined
      : typeof back === "function"
        ? back
        : () => router.back()

  // Montaje condicional, no CSS: jsdom no aplica CSS, asi que un arbol
  // duplicado escondido con `hidden` seguiria rompiendo `getByRole` por
  // ambiguedad -- y peor, dejaria pasar defectos.
  const isFill = layout === "fill"

  if (isDesktop) {
    return (
      // `min-h-0`: sin el, este contenedor no puede encogerse por debajo de su
      // contenido y la altura que baja de `<main>` se pierde aqui -- el hijo
      // con `flex-1` crece en vez de hacer scroll interno.
      <div className="flex min-h-0 flex-1 flex-col">
        <DesktopHeader
          title={title}
          desktopBack={desktopBackResolved}
          actions={actions}
          subtitle={subtitle}
          titleAdjacent={titleAdjacent}
          titleSize={titleSize}
          fill={isFill}
        />
        <div className={cn(isFill ? "flex min-h-0 flex-1 flex-col" : "flex flex-col px-7 py-6")}>
          <div
            data-slot="page-shell-content"
            className={
              isFill
                ? // Sin `max-w-[1084px]` (`CalendarioDesktop.dc.html:130` deja
                  // la rejilla a ancho completo) y sin gap por defecto: cada
                  // franja trae su espaciado. `contentClassName` sigue mandando.
                  cn("flex min-h-0 flex-1 flex-col", contentClassName)
                : cn(
                    "flex max-w-[1084px] flex-col",
                    // `contentClassName` SUSTITUYE el espaciado por defecto, no se
                    // suma: `gap-[18px]` y `space-y-4` son grupos distintos para
                    // tailwind-merge, asi que sobrevivirian los dos (34px en vez
                    // de los 18px que dibuja `EquipoDesktop:90`) si se aplicaran
                    // ambos a la vez.
                    contentClassName ? contentClassName : "gap-[18px]"
                  )
            }
          >
            {children}
          </div>
        </div>
      </div>
    )
  }

  const mobileActionsContent = mobileActions === undefined ? actions : mobileActions

  // `contentClassName` trae anchos calibrados contra los artboards de
  // ESCRITORIO (554/800/860px, `AjustesXDesktop.dc.html`). Colarlos tal
  // cual en esta rama pega el contenido a la izquierda de los 736px que
  // reserva `max-w-3xl` de aqui abajo, con hueco muerto a la derecha
  // (regresion real en `/settings/billing` y `/settings/booking` entre
  // 768-1023px). El espaciado (`space-y-4`, `gap-...`) si es universal,
  // asi que solo se descarta el token de ancho.
  const mobileContentClassName = contentClassName
    ?.split(" ")
    .filter((token) => !token.startsWith("max-w-"))
    .join(" ")

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <MobileHeader
        title={title}
        onBack={mobileBackResolved}
        actions={mobileActionsContent}
      />
      {/*
        `mx-auto max-w-3xl`: vive aqui, no en `<main>` de `layout.tsx`, para que
        la cabecera movil (hermana, arriba) pueda ocupar el ancho completo del
        `<main>` entre 768 y 1023px -- si el limite siguiera en `<main>`, la
        cabecera y su `border-b` se quedarian centrados con hueco a los lados.
      */}
      <div
        className={cn(
          // `fill` se queda con el `max-w-3xl` (el limite de lectura sigue
          // valiendo) y solo suelta el padding: `Calendario.dc.html:66` da a la
          // rejilla su propio `padding: 0 12px` bajo unas franjas fijas.
          isFill
            ? "mx-auto flex w-full min-h-0 flex-1 flex-col max-w-3xl"
            : "mx-auto w-full max-w-3xl p-4 md:py-6"
        )}
      >
        <div
          data-slot="page-shell-content"
          // `flex min-h-0 flex-1 flex-col` tambien AQUI: es el ultimo eslabon
          // de la cadena de alturas de movil; sin el, el hijo se pinta a su
          // alto natural y quien hace scroll es la pagina, no la rejilla.
          className={cn(isFill && "flex min-h-0 flex-1 flex-col", mobileContentClassName)}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

interface DesktopHeaderProps {
  title: string
  desktopBack?: { variant: "plain" | "bordered"; onBack: () => void }
  actions?: ReactNode
  subtitle?: ReactNode
  titleAdjacent?: ReactNode
  titleSize: "default" | "lg"
  /**
   * La familia de la rejilla dibuja la barra superior a `padding: 0 24px`
   * (`CalendarioDesktop.dc.html:74`), no a los 28px que usan los otros quince
   * artboards de escritorio. El cuerpo de `fill` tambien va a 24
   * (`CalendarioDesktop.dc.html:103,130`), asi que dejar la cabecera en 28
   * sacaria el titulo y el CTA 4px fuera del canal de horas de abajo.
   */
  fill: boolean
}

function DesktopHeader({
  title,
  desktopBack,
  actions,
  subtitle,
  titleAdjacent,
  titleSize,
  fill,
}: DesktopHeaderProps) {
  return (
    <div
      className={cn(
        "flex h-[72px] shrink-0 items-center justify-between border-b border-border",
        fill ? "pr-6" : "pr-7",
        desktopBack ? "pl-[18px]" : fill ? "pl-6" : "pl-7"
      )}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        {desktopBack && (
          <Button
            variant={desktopBack.variant === "bordered" ? "outline" : "ghost"}
            size="icon"
            aria-label="Volver"
            onClick={desktopBack.onBack}
            className="size-[38px] shrink-0"
          >
            <ChevronLeft className="size-[18px]" />
          </Button>
        )}
        <div className={cn("flex min-w-0 flex-col", desktopBack?.variant === "bordered" && "pl-2")}>
          <div className="flex items-center gap-4 min-w-0">
            <h1
              className={cn(
                "font-heading font-semibold tracking-display",
                titleSize === "lg" ? "text-[26px] tracking-[-0.015em]" : "text-2xl"
              )}
            >
              {title}
            </h1>
            {titleAdjacent}
          </div>
          {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2.5">{actions}</div>}
    </div>
  )
}

interface MobileHeaderProps {
  title: string
  onBack?: () => void
  actions?: ReactNode
}

function MobileHeader({ title, onBack, actions }: MobileHeaderProps) {
  const hasBack = onBack !== undefined
  return (
    <div
      className={cn(
        // `sticky top-0 z-40` + fondo opaco: el `AppHeader` que sustituyo a
        // esta cabecera lo era; sin ello, en `/settings/business-hours`
        // (donde "Guardar" vive aqui, `Horario.dc.html:37`) hay que volver
        // arriba a mano tras editar los siete dias.
        "sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-background",
        hasBack ? "pl-2 pr-3.5" : "px-4"
      )}
    >
      <div className="flex min-w-0 items-center gap-1">
        {hasBack && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Volver"
            onClick={onBack}
            className="size-11 shrink-0"
          >
            <ChevronLeft className="size-5" />
          </Button>
        )}
        <h1
          className={cn(
            "truncate font-heading font-semibold tracking-display",
            hasBack ? "text-[15px]" : "text-[21px] tracking-[-0.01em]"
          )}
        >
          {title}
        </h1>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
