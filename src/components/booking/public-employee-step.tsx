"use client"

import { ChevronRight, Users } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { BookingStepShell } from "@/components/booking/booking-step-shell"
import { BookingSummaryAside, type BookingSummaryRow } from "@/components/booking/booking-summary-aside"
import { UnavailableNotice } from "@/components/booking/unavailable-notice"
import { usePublicBookingStore } from "@/lib/stores/public-booking-store"
import { formatCurrency, initials } from "@/lib/utils/format"
import { formatDuration } from "@/lib/utils/dates"
import { cn } from "@/lib/utils"
import type { SalonPublic, EmployeePublic } from "@/types/salon"

interface PublicEmployeeStepProps {
  salon: SalonPublic
}

/**
 * `design/ReservaPaso2.dc.html:19` only draws two real employees (Laura in
 * orange/`--chart-1`, Sofia in green/`--chart-2`), each with its own tint
 * background. The blue/gold pairs below extend that same tint-of-`--chart-N`
 * pattern to a 3rd/4th employee, which the artboard never had to draw --
 * extrapolated, not read off the file. Disabled employees are NOT part of
 * this cycle: they always get the fixed `#F0EAE3`/`#9A8A7E` pair
 * (`design/ReservaPaso2.dc.html:91`), regardless of position.
 */
const AVATAR_PALETTE = [
  "bg-[#F6E7E0] text-[#B4522F]", // --chart-1
  "bg-[#E8EEE7] text-[#5C7A5E]", // --chart-2
  "bg-[#E7ECF0] text-[#4A6274]", // --chart-3, tint extrapolated
  "bg-[#F3E9DC] text-[#A8762F]", // --chart-4, tint extrapolated
]
const DISABLED_AVATAR = "bg-[#F0EAE3] text-[#9A8A7E]"

export function PublicEmployeeStep({ salon }: PublicEmployeeStepProps) {
  const { selectedService, selectedEmployeeId, anyEmployee, selectEmployee, nextStep, prevStep } =
    usePublicBookingStore()

  const handleSelect = (employeeId: string | null, any: boolean) => {
    selectEmployee(employeeId, any)
    nextStep()
  }

  const offersSelectedService = (employee: EmployeePublic) =>
    !selectedService || employee.serviceIds.includes(selectedService.id)

  // Solo cuando la lista llega vacia: el flag explica un vacio, no tapa
  // profesionales reales.
  const employeesUnreachable = salon.employeesUnavailable && salon.employees.length === 0

  // Unica condicion que habilita el avance al paso 3. "Sin preferencia" no lleva
  // employeeId y public-datetime-step lo resuelve con el primero que ofrezca el
  // servicio; si no hay ninguno esa busqueda falla, la consulta de huecos se
  // queda desactivada (y una query desactivada reporta isLoading false, asi que
  // ni siquiera sale el spinner) y el visitante ve 30 dias vacios sin
  // explicacion. Cubre los tres vacios: lista caida, salon sin profesionales y
  // profesionales que no hacen el servicio elegido — en los tres el some() es
  // false. El aviso, en cambio, NO se puede unificar: solo el primero es un
  // fallo de carga, los otros dos son informacion cierta sobre el salon.
  const someoneOffersService = salon.employees.some(offersSelectedService)

  const isUsableList = !employeesUnreachable && salon.employees.length > 0 && someoneOffersService

  const employeeCards = salon.employees.map((employee, index) => {
    const isSelected = !anyEmployee && selectedEmployeeId === employee.id
    const offersService = offersSelectedService(employee)
    const fullName = `${employee.firstName} ${employee.lastName}`.trim()

    return (
      // `button`, no `Card`: `Card` pinta un `div`, y con el `onClick` encima
      // la pantalla se quedaba sin ningun elemento enfocable -- ni teclado ni
      // lector de pantalla podian elegir profesional. `disabled` en vez de
      // `pointer-events-none` para que quien no ofrece el servicio tambien
      // quede fuera del orden de tabulacion, no solo del raton.
      <button
        key={employee.id}
        type="button"
        aria-pressed={isSelected}
        disabled={!offersService}
        className={cn(
          // `bg-card` explicito: al dejar de usar `Card` se perdio, y las tarjetas
          // salian del color del fondo de pagina en vez de blancas
          // (`design/ReservaPaso2.dc.html:18`, `ReservaDesktopPaso2.dc.html:20`).
          "flex w-full flex-row items-center gap-3 rounded-[10px] border border-border bg-card p-3.5 text-left text-sm transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none lg:gap-[14px] lg:p-4",
          offersService
            ? "cursor-pointer hover:bg-muted/50"
            : "opacity-[0.55] lg:opacity-50",
          isSelected && "border-primary bg-primary/5"
        )}
        onClick={() => offersService && handleSelect(employee.id, false)}
      >
        <Avatar className="size-11">
          <AvatarFallback
            className={cn(
              "text-sm font-semibold",
              offersService ? AVATAR_PALETTE[index % AVATAR_PALETTE.length] : DISABLED_AVATAR
            )}
          >
            {initials(employee.firstName, employee.lastName)}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-1 flex-col gap-0.5">
          <p className="text-sm font-semibold">{fullName}</p>
          <p className="text-xs text-muted-foreground">
            {offersService
              ? employee.jobTitle
              : `No ofrece ${selectedService?.name ?? "este servicio"}`}
          </p>
        </div>
        {/*
          `design/ReservaPaso2.dc.html:72-75` paints each offering employee's
          next free slot here ("Antes · Mie 11:00"). `EmployeePublic`
          (src/types/salon.ts:31-37) carries no availability data, and
          computing it here would mean one slots call per employee -- out of
          scope for this task. Left for whichever task wires real
          availability into this step.
        */}
      </button>
    )
  })

  const serviceSummary = selectedService && (
    <p className="text-[13px] text-muted-foreground lg:hidden">
      {selectedService.name} &middot; {formatDuration(selectedService.durationMinutes)}{" "}
      &middot; {formatCurrency(selectedService.price, selectedService.currency)}
    </p>
  )

  const summaryRows: BookingSummaryRow[] = [
    {
      label: "Servicio",
      value: selectedService?.name,
      detail: selectedService && (
        <>
          {formatDuration(selectedService.durationMinutes)} &middot;{" "}
          {formatCurrency(selectedService.price, selectedService.currency)}
        </>
      ),
    },
    { label: "Profesional" },
    { label: "Fecha y hora" },
  ]

  // Elegir profesional avanza al momento (`handleSelect` llama a `nextStep`):
  // este paso no tiene un "seleccionar y luego confirmar", asi que el CTA del
  // aside nunca se habilita aqui -- coincide con
  // `design/ReservaDesktopPaso2.dc.html:109`, donde ya sale apagado.
  const aside = <BookingSummaryAside rows={summaryRows} ctaLabel="Continuar" ctaDisabled />

  // El texto de ayuda del footer movil (`design/ReservaPaso2.dc.html:100-102`)
  // solo tiene sentido cuando la lista es utilizable: en los vacios (lista
  // caida, sin profesionales, nadie ofrece el servicio) no hay nada que "ver
  // solo sus huecos libres".
  const footer = isUsableList ? (
    <p className="text-center text-[11px] leading-[1.5] text-muted-foreground-2">
      Si eliges profesional veras solo sus huecos libres.
    </p>
  ) : undefined

  return (
    <BookingStepShell
      salon={salon}
      step={2}
      title="Con quien la quieres"
      // Solo escritorio: `design/ReservaDesktopPaso2.dc.html:64` lo pone bajo
      // el titulo, pero el artboard movil lo lleva en el pie
      // (`design/ReservaPaso2.dc.html:100-102`), donde ya lo pinta `footer`.
      // Sin esta condicion salia dos veces en movil.
      subtitle={
        <span className="hidden lg:inline">
          Si eliges profesional veras solo sus huecos libres.
        </span>
      }
      onBack={prevStep}
      aside={aside}
      footer={footer}
    >
      {serviceSummary}

      {employeesUnreachable ? (
        <UnavailableNotice
          title="No hemos podido cargar los profesionales"
          description="Vuelve a intentarlo en unos minutos."
        />
      ) : salon.employees.length === 0 ? (
        // El salon no tiene a nadie. Mandarle a cambiar de servicio seria
        // pasearle por la lista entera para encontrar el mismo vacio, asi que
        // aqui no se ofrece salida: no la hay.
        <div className="py-8 text-center">
          <p className="text-sm text-muted-foreground">
            Este salon no tiene profesionales disponibles para reserva online.
          </p>
        </div>
      ) : !someoneOffersService ? (
        // Hay profesionales, pero ninguno tiene asignado este servicio. Aqui si
        // hay salida y es concreta: la flecha de atras del paso. Se siguen
        // enseñando las tarjetas, apagadas y con su "No ofrece X": son el
        // referente de "estos profesionales" y ademas prueban que el salon si
        // tiene equipo.
        <div className="space-y-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Ninguno de estos profesionales ofrece {selectedService?.name ?? "este servicio"}.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Vuelve atras para elegir otro servicio.
            </p>
          </div>
          <div className="flex flex-col gap-2.5 lg:grid lg:grid-cols-2 lg:gap-[14px]">
            {employeeCards}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5 lg:grid lg:grid-cols-2 lg:gap-[14px]">
          <button
            type="button"
            aria-pressed={anyEmployee}
            className={cn(
              "flex w-full flex-row items-center gap-3 rounded-[10px] border border-dashed border-[#D8C9B8] bg-muted p-3.5 text-left transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none lg:gap-[14px] lg:p-4",
              anyEmployee && "border-primary bg-primary/5"
            )}
            onClick={() => handleSelect(null, true)}
          >
            <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-border text-muted-foreground">
              <Users className="h-5 w-5" />
            </div>
            <div className="flex flex-1 flex-col gap-0.5">
              <p className="text-sm font-semibold">Sin preferencia</p>
              <p className="text-xs text-muted-foreground">El primero disponible &middot; mas horas libres</p>
            </div>
            <ChevronRight className="size-[18px] shrink-0 text-text-subtle lg:hidden" />
          </button>

          <p className="text-[11px] font-semibold tracking-wider text-muted-foreground-2 uppercase lg:hidden">
            O elige profesional
          </p>

          {employeeCards}
        </div>
      )}
    </BookingStepShell>
  )
}
