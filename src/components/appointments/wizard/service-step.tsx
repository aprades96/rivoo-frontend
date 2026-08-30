"use client"

import { Fragment, useMemo } from "react"
import { NewAppointmentShell } from "./new-appointment-shell"
import { WizardContextPills } from "./wizard-context-pills"
import { useWizardNavigation } from "./use-wizard-navigation"
import { getWizardSummaryCta, getWizardSummaryRows } from "./wizard-summary"
import { WizardSummaryAside } from "@/components/wizard/wizard-summary-aside"
import { LoadingSkeleton } from "@/components/shared/loading-skeleton"
import { useServices, useEmployeeServices } from "@/hooks/use-staff"
import { useMediaQuery } from "@/hooks/use-media-query"
import { useWizardStore } from "@/lib/stores/wizard-store"
import { formatCurrency } from "@/lib/utils/format"
import { formatDurationTight } from "@/lib/utils/dates"
import { cn } from "@/lib/utils"
import type { ServiceOffering } from "@/types/service"

// Tailwind's `lg:` breakpoint (1024px) -- keep in sync with
// `new-appointment-shell.tsx`. Needed here (and not just inside the shell)
// because the mobile/desktop card markup for a service genuinely differs
// (row vs grid, and the "no ofrece" wording is worded differently per
// artboard), so per the width-difference rule this is decided once in JS,
// not with `hidden lg:...` pairs that would leave both wordings in the DOM.
const DESKTOP_QUERY = "(min-width: 1024px)"

interface ServiceGroup {
  category: string | null
  services: ServiceOffering[]
}

/**
 * Agrupa por categoria NORMALIZADA (`category?.trim() || null`), en el orden
 * de aparicion de la lista. `null` y `""` colapsan en el MISMO grupo final
 * SIN cabecera -- `service-form.tsx:88-97` manda `category: ""` a proposito
 * cuando el campo se deja vacio (el PUT del backend fusiona por presencia de
 * clave, asi que omitirla significa "no cambies") y
 * `ServiceOfferingService.java:47` lo persiste tal cual sin normalizar, asi
 * que en produccion "sin categoria" es casi siempre la cadena vacia, no
 * `null`. Agrupar por `category === null` o por `category ?? "Otros"`
 * crearia una cabecera vacia de mas con su propio `margin-top` -- ningun
 * artboard dibuja una cabecera "Otros".
 */
export function groupServicesByCategory(services: ServiceOffering[]): ServiceGroup[] {
  const order: string[] = []
  const byCategory = new Map<string, ServiceOffering[]>()
  const uncategorized: ServiceOffering[] = []

  for (const service of services) {
    const category = service.category?.trim() || null
    if (category === null) {
      uncategorized.push(service)
      continue
    }
    if (!byCategory.has(category)) {
      order.push(category)
      byCategory.set(category, [])
    }
    byCategory.get(category)!.push(service)
  }

  const groups: ServiceGroup[] = order.map((category) => ({ category, services: byCategory.get(category)! }))
  if (uncategorized.length > 0) groups.push({ category: null, services: uncategorized })
  return groups
}

export function ServiceStep() {
  const { onClose, onBack } = useWizardNavigation()
  const isDesktop = useMediaQuery(DESKTOP_QUERY)

  const { data: servicesData, isLoading: servicesLoading } = useServices()
  const wizardState = useWizardStore()
  const { selectedEmployee, anyEmployee, selectService, nextStep } = wizardState

  const employeeId = !anyEmployee ? selectedEmployee?.id : undefined
  const { data: employeeServicesData, isError: employeeServicesError } = useEmployeeServices(employeeId)

  const services = useMemo(
    () => servicesData?.content?.filter((s) => s.isActive) ?? [],
    [servicesData]
  )

  // `null` mientras no hay forma de saber que ofrece el empleado (peticion en
  // vuelo, o "Sin preferencia" sin empleado que consultar): en ese hueco nada
  // se atenua, igual que hacia el filtro que este paso reemplaza.
  const assignedIds = useMemo(
    () => (employeeServicesData ? new Set(employeeServicesData.map((es) => es.serviceId)) : null),
    [employeeServicesData]
  )

  // El backend NO valida que el empleado ofrezca el servicio elegido
  // (`AppointmentService.java:86`): este filtro es la UNICA barrera. Por eso
  // un FALLO de `useEmployeeServices` (`isError`) no puede tratarse como la
  // peticion en vuelo -- `assignedIds` tambien es `null` ahi, pero fallar
  // ABIERTO dejaria pasar cualquier servicio a un empleado concreto sin que
  // nadie mas lo compruebe. Se falla CERRADO: con la comprobacion caida, se
  // atenua TODO salvo con "Sin preferencia" (`anyEmployee`), donde no hay
  // empleado concreto que consultar.
  const isOffered = (service: ServiceOffering) => {
    if (anyEmployee) return true
    if (employeeServicesError) return false
    return assignedIds === null || assignedIds.has(service.id)
  }

  const groups = useMemo(() => groupServicesByCategory(services), [services])

  const handleSelect = (service: ServiceOffering) => {
    if (!isOffered(service)) return
    selectService(service)
    nextStep()
  }

  // "Sin preferencia" no tiene sujeto para "Solo los que ofrece {nombre}." --
  // ningun artboard dibuja una alternativa para ese caso, asi que el
  // subtitulo de escritorio simplemente se omite.
  const subtitle =
    selectedEmployee && !anyEmployee
      ? `Solo los que ofrece ${selectedEmployee.firstName} ${selectedEmployee.lastName}.`
      : undefined

  const rows = getWizardSummaryRows(wizardState, 2)
  const cta = getWizardSummaryCta(wizardState, 2)
  // `heading`/`note` por defecto de `WizardSummaryAside` son los de la
  // reserva PUBLICA ("Tu reserva" + nota de confianza sin registro/cancela
  // gratis) -- correctos ahi, pero esta es una cita que crea el propio salon:
  // ni es sin registro ni se cancela gratis, y ningun artboard del asistente
  // dibuja esa nota (`NuevaCitaDesktopPaso2.dc.html:130` dice "Resumen").
  // Mismo par que ya usan los demas pasos del asistente (`employee-step.tsx`,
  // `confirmation-step.tsx`).
  const aside = (
    <WizardSummaryAside
      rows={rows}
      ctaLabel={cta.label}
      ctaDisabled={cta.disabled}
      heading="Resumen"
      note={null}
    />
  )

  // Aviso visible cuando la comprobacion de que ofrece el empleado FALLA
  // (`isError`): con "Sin preferencia" no aplica (no hay empleado concreto
  // que consultar). Sin este aviso, `isOffered` fallando cerrado atenuaria
  // TODOS los servicios sin explicar por que -- una lista muda de tarjetas
  // grises.
  const showAssignmentErrorBanner = employeeServicesError && !anyEmployee

  const notOfferedText = (isDesktopView: boolean): string | undefined => {
    if (!selectedEmployee) return undefined
    if (employeeServicesError) return "No se ha podido comprobar"
    return isDesktopView
      ? `${selectedEmployee.firstName} no lo ofrece`
      : `${selectedEmployee.firstName} no ofrece este servicio`
  }

  return (
    <NewAppointmentShell
      step={2}
      title="Elige un servicio"
      subtitle={subtitle}
      onBack={onBack}
      onClose={onClose}
      aside={aside}
    >
      {!isDesktop && <WizardContextPills />}

      {showAssignmentErrorBanner && (
        <div
          role="alert"
          className="rounded-lg border border-destructive-border bg-destructive-soft px-3 py-2 text-sm text-destructive"
        >
          No se ha podido comprobar qué servicios ofrece {selectedEmployee?.firstName}. Actualiza la
          página o vuelve a intentarlo.
        </div>
      )}

      {servicesLoading ? (
        <LoadingSkeleton count={5} />
      ) : isDesktop ? (
        <>
          {groups.map((group) => (
            <Fragment key={group.category ?? "__uncategorized"}>
              {group.category && (
                <span className="text-[12px] leading-tight font-semibold tracking-[0.05em] text-muted-foreground-2 uppercase">
                  {group.category}
                </span>
              )}
              <div className="grid grid-cols-2 gap-[14px]">
                {group.services.map((service) => (
                  <ServiceCard
                    key={service.id}
                    service={service}
                    offered={isOffered(service)}
                    notOfferedText={notOfferedText(true)}
                    isDesktop
                    onSelect={() => handleSelect(service)}
                  />
                ))}
              </div>
            </Fragment>
          ))}
        </>
      ) : (
        <div className="flex flex-col gap-2.5">
          {groups.map((group, index) => (
            <Fragment key={group.category ?? "__uncategorized"}>
              {group.category && (
                <span
                  className={cn(
                    "text-[11px] leading-tight font-semibold tracking-[0.05em] text-muted-foreground-2 uppercase",
                    index > 0 && "mt-1"
                  )}
                >
                  {group.category}
                </span>
              )}
              {group.services.map((service) => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  offered={isOffered(service)}
                  notOfferedText={notOfferedText(false)}
                  isDesktop={false}
                  onSelect={() => handleSelect(service)}
                />
              ))}
            </Fragment>
          ))}
        </div>
      )}
    </NewAppointmentShell>
  )
}

interface ServiceCardProps {
  service: ServiceOffering
  offered: boolean
  notOfferedText?: string
  isDesktop: boolean
  onSelect: () => void
}

/**
 * `.svc` (`NuevaCitaPaso2.dc.html:18`) y `.card` (`NuevaCitaDesktopPaso2.dc.html:20`)
 * son la misma caja (`justify-content:space-between`, nombre+duracion a la
 * izquierda, precio a la derecha) con solo el `gap`/`padding` distintos entre
 * movil y escritorio -- de ahi un unico componente con `isDesktop` en vez de
 * dos copias. `button`, no `div`+`onClick`: `disabled` saca el servicio no
 * ofrecido del orden de tabulacion Y evita el click sin logica extra, igual
 * que `public-employee-step.tsx:79,90`.
 */
function ServiceCard({ service, offered, notOfferedText, isDesktop, onSelect }: ServiceCardProps) {
  return (
    <button
      type="button"
      disabled={!offered}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-[10px] border border-border bg-card text-left",
        isDesktop ? "gap-[14px] p-4" : "p-[14px]",
        offered ? "cursor-pointer hover:bg-muted/50" : "opacity-50"
      )}
    >
      <div className="flex min-w-0 flex-col gap-[3px]">
        <span className="text-[15px] leading-tight font-semibold">{service.name}</span>
        <span className="text-[12px] leading-tight text-muted-foreground">
          {offered ? formatDurationTight(service.durationMinutes) : notOfferedText}
        </span>
      </div>
      <span className="shrink-0 font-heading text-[20px] leading-tight font-semibold tracking-display tabular-nums whitespace-nowrap">
        {formatCurrency(service.price)}
      </span>
    </button>
  )
}
