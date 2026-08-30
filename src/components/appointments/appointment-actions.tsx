"use client"

import { Check, Play, CircleCheck, X, UserX, Calendar, Loader2, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { AppointmentStatus } from "@/types/appointment"

/**
 * `sheet` = hoja inferior de movil (`design/DetalleCita.dc.html`), `panel` =
 * columna acoplada de escritorio (`design/DetalleCitaDesktop.dc.html`). No es
 * un simple `lg:` porque las DOS acciones ofrecidas en `PENDING` son distintas
 * por ancho (D5), no solo su tamano.
 */
export type AppointmentActionsVariant = "sheet" | "panel"

interface AppointmentActionsProps {
  status: AppointmentStatus
  variant: AppointmentActionsVariant
  onStatusChange: (status: AppointmentStatus) => void
  onCancelRequest: () => void
  /** Solo lo usa `PENDING` en `variant="panel"` (Reprogramar, D6). Quien construye la URL es T9. */
  onReschedule?: () => void
  isPending: boolean
}

type ActionIntent =
  | { kind: "status"; target: AppointmentStatus }
  | { kind: "cancel" }
  | { kind: "reschedule" }

interface ActionDef {
  label: string
  icon: LucideIcon
  intent: ActionIntent
  destructive?: boolean
}

interface ActionsSpec {
  cta: ActionDef
  secondary: ActionDef[]
}

const CANCEL_ACTION: ActionDef = {
  label: "Cancelar",
  icon: X,
  intent: { kind: "cancel" },
  destructive: true,
}

/**
 * Matriz normativa de T5 (`docs/specs/detalle-cita/IMPLEMENTATION_PLAN.md`,
 * §5 T5). `PENDING` es la unica excepcion respecto a la maquina de estados de
 * hoy (D4): ahi manda cada artboard y los dos anchos ofrecen acciones
 * distintas sobre el mismo estado (D5). El resto se conserva tal cual estaba
 * (`appointment-detail-sheet.tsx:223-240` antes de esta tarea).
 */
function actionsFor(status: AppointmentStatus, variant: AppointmentActionsVariant): ActionsSpec | null {
  switch (status) {
    case "PENDING":
      return {
        cta: { label: "Confirmar cita", icon: Check, intent: { kind: "status", target: "CONFIRMED" } },
        secondary:
          variant === "sheet"
            ? [
                { label: "No asistió", icon: UserX, intent: { kind: "status", target: "NO_SHOW" } },
                CANCEL_ACTION,
              ]
            : [
                { label: "Reprogramar", icon: Calendar, intent: { kind: "reschedule" } },
                CANCEL_ACTION,
              ],
      }
    case "CONFIRMED":
      return {
        cta: { label: "Iniciar", icon: Play, intent: { kind: "status", target: "IN_PROGRESS" } },
        secondary: [
          { label: "No asistió", icon: UserX, intent: { kind: "status", target: "NO_SHOW" } },
          CANCEL_ACTION,
        ],
      }
    case "IN_PROGRESS":
      return {
        cta: { label: "Completar", icon: CircleCheck, intent: { kind: "status", target: "COMPLETED" } },
        /**
         * Sin "Cancelar": ningun artboard dibuja `IN_PROGRESS`, asi que
         * aqui manda la maquina de estados del servidor, no el diseno. El
         * dominio solo permite `IN_PROGRESS -> COMPLETED`
         * (`appointment-service/.../domain/model/AppointmentStatus.java:25`,
         * `case IN_PROGRESS -> target == COMPLETED`) y `AppointmentService`
         * valida `canTransitionTo(CANCELLED)` antes de cancelar, devolviendo
         * 4xx. Ofrecer el boton producia un fallo silencioso: la cita
         * parpadeaba a "Cancelada" y volvia sin ningun mensaje.
         */
        secondary: [],
      }
    // COMPLETED, CANCELLED, NO_SHOW — estados terminales, ninguna accion (D4).
    default:
      return null
  }
}

export function AppointmentActions({
  status,
  variant,
  onStatusChange,
  onCancelRequest,
  onReschedule,
  isPending,
}: AppointmentActionsProps) {
  /**
   * Spinner GLOBAL, deliberado: no "por boton pulsado". Se intento una
   * version que recordaba en un `useState` el rotulo del boton pulsado
   * (`firedLabel`) para encender el spinner solo ahi -- se revirtio porque
   * `useUpdateAppointmentStatus` es OPTIMISTA
   * (`src/hooks/use-appointments.ts:93-114`): la cache cambia de estado en
   * cuanto se pulsa, antes de que conteste la peticion. Eso significa que el
   * boton que el usuario pulso puede dejar de existir a mitad de vuelo (p.ej.
   * PENDING --"Confirmar cita"--> CONFIRMED hace que `actionsFor` ya no
   * devuelva "Confirmar cita" sino "Iniciar"), asi que no hay ningun boton
   * concreto sobre el que "recordar" el spinner sin que la matriz de estados
   * deje huecos sin pintar. No lo vuelvas a intentar por intent: con
   * mutacion optimista no hay boton estable al que atar el recuerdo. Lo
   * honesto aqui es "hay algo en vuelo -> todo deshabilitado", que es
   * exactamente lo que hace `isPending` a continuacion.
   */
  const spec = actionsFor(status, variant)
  if (!spec) return null

  const isSheet = variant === "sheet"

  const run = (action: ActionDef) => {
    switch (action.intent.kind) {
      case "status":
        onStatusChange(action.intent.target)
        break
      case "cancel":
        onCancelRequest()
        break
      case "reschedule":
        onReschedule?.()
        break
    }
  }

  return (
    <div
      data-testid="appointment-actions"
      className={cn("flex flex-col", isSheet ? "gap-2" : "mt-auto gap-[9px]")}
    >
      <CtaButton
        variant={variant}
        action={spec.cta}
        isPending={isPending}
        onClick={() => run(spec.cta)}
      />
      {spec.secondary.length > 0 && (
        <div
          data-testid="appointment-actions-secondary"
          className={cn(isSheet ? "flex gap-2" : "grid grid-cols-2 gap-[9px]")}
        >
          {spec.secondary.map((action) => (
            <SecondaryButton
              key={action.label}
              variant={variant}
              action={action}
              isPending={isPending}
              onClick={() => run(action)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * `variant="sheet"`: 48px, icono 18px (`DetalleCita.dc.html:98-101`).
 * `variant="panel"`: 46px, icono 17px (`DetalleCitaDesktop.dc.html:315-318`).
 */
function CtaButton({
  variant,
  action,
  isPending,
  onClick,
}: {
  variant: AppointmentActionsVariant
  action: ActionDef
  isPending: boolean
  onClick: () => void
}) {
  const Icon = action.icon
  const iconSize = variant === "sheet" ? "size-[18px]" : "size-[17px]"

  return (
    <button
      type="button"
      data-testid="appointment-cta"
      disabled={isPending}
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-2 rounded-lg bg-primary text-[15px] font-semibold text-primary-foreground transition-colors disabled:pointer-events-none disabled:opacity-50",
        variant === "sheet" ? "h-12" : "h-[46px]"
      )}
    >
      {isPending ? (
        <Loader2 className={cn(iconSize, "animate-spin")} />
      ) : (
        <Icon className={iconSize} strokeWidth={2.25} />
      )}
      {action.label}
    </button>
  )
}

/**
 * `variant="sheet"`: fila `flex` con `flex-grow:1`, 46px, icono 16px
 * (`DetalleCita.dc.html:102-111`). `variant="panel"`: celda de
 * `grid-cols-2`, 40px, icono 15px (`DetalleCitaDesktop.dc.html:319-328`,
 * `.act` en `:27`). Con una sola accion secundaria, `flex-grow:1` la ocupa
 * entera en `sheet` y una unica celda de la rejilla en `panel` -- ninguna de
 * las dos formas necesita un caso especial, es el comportamiento natural de
 * `flex`/`grid` con un solo hijo.
 */
function SecondaryButton({
  variant,
  action,
  isPending,
  onClick,
}: {
  variant: AppointmentActionsVariant
  action: ActionDef
  isPending: boolean
  onClick: () => void
}) {
  const Icon = action.icon
  const isSheet = variant === "sheet"
  const iconSize = isSheet ? "size-4" : "size-[15px]"

  return (
    <button
      type="button"
      data-testid="appointment-secondary-action"
      disabled={isPending}
      onClick={onClick}
      className={cn(
        "flex items-center justify-center rounded-lg border bg-card font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
        isSheet ? "h-[46px] flex-1 gap-[7px] text-[14px]" : "h-10 gap-[7px] text-[13px] font-semibold",
        action.destructive
          ? "border-destructive-border text-destructive"
          : cn("border-border", !isSheet && "text-foreground")
      )}
    >
      {isPending ? (
        <Loader2 className={cn(iconSize, "animate-spin")} />
      ) : (
        <Icon
          className={cn(iconSize, !action.destructive && "text-muted-foreground")}
          strokeWidth={1.75}
        />
      )}
      {action.label}
    </button>
  )
}
