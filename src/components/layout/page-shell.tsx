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
  if (isDesktop) {
    return (
      <div className="flex flex-1 flex-col">
        <DesktopHeader
          title={title}
          desktopBack={desktopBackResolved}
          actions={actions}
          subtitle={subtitle}
          titleAdjacent={titleAdjacent}
          titleSize={titleSize}
        />
        <div className="flex flex-col px-7 py-6">
          <div
            data-slot="page-shell-content"
            className={cn(
              "flex max-w-[1084px] flex-col",
              // `contentClassName` SUSTITUYE el espaciado por defecto, no se
              // suma: `gap-[18px]` y `space-y-4` son grupos distintos para
              // tailwind-merge, asi que sobrevivirian los dos (34px en vez
              // de los 18px que dibuja `EquipoDesktop:90`) si se aplicaran
              // ambos a la vez.
              contentClassName ? contentClassName : "gap-[18px]"
            )}
          >
            {children}
          </div>
        </div>
      </div>
    )
  }

  const mobileActionsContent = mobileActions === undefined ? actions : mobileActions

  return (
    <div className="flex flex-1 flex-col">
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
      <div className="mx-auto w-full max-w-3xl p-4 md:py-6">
        <div data-slot="page-shell-content" className={cn(contentClassName)}>
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
}

function DesktopHeader({
  title,
  desktopBack,
  actions,
  subtitle,
  titleAdjacent,
  titleSize,
}: DesktopHeaderProps) {
  return (
    <div
      className={cn(
        "flex h-[72px] shrink-0 items-center justify-between border-b border-border pr-7",
        desktopBack ? "pl-[18px]" : "pl-7"
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
