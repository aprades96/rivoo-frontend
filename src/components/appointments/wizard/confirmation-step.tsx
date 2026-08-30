"use client"

import type { ReactNode } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { NewAppointmentShell } from "./new-appointment-shell"
import { useWizardNavigation } from "./use-wizard-navigation"
import { WizardSummaryAside } from "@/components/wizard/wizard-summary-aside"
import { getWizardSummaryRows, getWizardSummaryTotal, getWizardSummaryCta, formatWizardTimeRange } from "./wizard-summary"
import type { WizardSummaryState } from "./wizard-summary"
import { useWizardStore } from "@/lib/stores/wizard-store"
import { useAuth } from "@/hooks/use-auth"
import { useEmployees } from "@/hooks/use-staff"
import { useMediaQuery } from "@/hooks/use-media-query"
import { appointmentsApi } from "@/lib/api/appointments"
import { clientsApi } from "@/lib/api/clients"
import { employeePaletteIndex, employeeSolidColor } from "@/lib/utils/avatar"
import { formatDateLong, formatDurationTight } from "@/lib/utils/dates"
import { cn } from "@/lib/utils"
import type { Appointment } from "@/types/appointment"

// Tailwind's `lg:` breakpoint (1024px) -- keep in sync with
// `new-appointment-shell.tsx:13`. El chasis ya reacciona a la misma query
// para su propio cromo; este paso necesita su PROPIA lectura porque la
// pildora de estado y el cuerpo de la tarjeta cambian de TEXTO entre anchos
// (`NuevaCitaPaso5.dc.html:57` dice "Pendiente", `NuevaCitaDesktopPaso5.dc.html:78`
// dice "Se creara como Pendiente"), no solo de clase CSS -- un `hidden lg:block`
// dejaria las dos frases en el DOM a la vez.
const DESKTOP_QUERY = "(min-width: 1024px)"

const SUBMIT_ERROR_MESSAGE = "Error al crear la cita. Puede que el hueco ya no este disponible."

export function ConfirmationStep() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { accessToken } = useAuth()
  const { onClose, onBack } = useWizardNavigation()
  const isDesktop = useMediaQuery(DESKTOP_QUERY)

  const {
    selectedEmployee,
    anyEmployee,
    selectedService,
    selectedDate,
    selectedSlot,
    selectedSlotEmployeeId,
    selectedClient,
    newClientData,
    notes,
    setNotes,
    reset,
  } = useWizardStore()

  const { data: employeesData } = useEmployees()
  const employees = employeesData?.content ?? []

  const mutation = useMutation({
    mutationFn: async (): Promise<Appointment> => {
      if (!selectedService || !selectedSlot || !accessToken || !selectedSlotEmployeeId) {
        // No deberia ocurrir: el CTA esta deshabilitado (`getWizardSummaryCta`)
        // hasta que estos cuatro esten resueltos. Falla alto en vez de mandar
        // un POST que el backend rechazaria igual.
        throw new Error("Faltan datos para crear la cita")
      }

      // El alta del cliente nuevo vive DENTRO de la mutacion: si el POST de la
      // cita fallase despues de crear el cliente, un `await` suelto fuera de
      // aqui dejaria el cliente creado sin que nadie se enterase.
      let clientId = selectedClient?.id
      let clientName = selectedClient
        ? `${selectedClient.firstName} ${selectedClient.lastName}`
        : undefined

      if (!clientId && newClientData) {
        const createdClient = await clientsApi.create(
          {
            firstName: newClientData.firstName,
            lastName: newClientData.lastName,
            email: newClientData.email || undefined,
            phone: newClientData.phone || undefined,
          },
          accessToken
        )
        clientId = createdClient.id
        clientName = `${newClientData.firstName} ${newClientData.lastName}`
      }

      // `employeeId` SIEMPRE de `selectedSlotEmployeeId` -- el dueno del hueco
      // que guardo el paso 3, nunca `selectedEmployee?.id`: con "Sin
      // preferencia" no hay `selectedEmployee` y la cita necesita a alguien.
      return appointmentsApi.create(
        {
          employeeId: selectedSlotEmployeeId,
          serviceId: selectedService.id,
          startTime: selectedSlot,
          clientId: clientId || undefined,
          clientName,
          clientEmail: newClientData?.email || selectedClient?.email || undefined,
          clientPhone: newClientData?.phone || selectedClient?.phone || undefined,
          notes: notes || undefined,
        },
        accessToken
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] })
      queryClient.invalidateQueries({ queryKey: ["clients"] })
      toast.success("Cita creada correctamente")
      reset()
      router.push("/today")
    },
    onError: () => {
      toast.error(SUBMIT_ERROR_MESSAGE)
    },
  })

  const summaryState: WizardSummaryState = {
    selectedEmployee,
    anyEmployee,
    selectedService,
    selectedDate,
    selectedSlot,
    selectedClient,
    newClientData,
  }
  const summaryRows = getWizardSummaryRows(summaryState, 5)
  const summaryTotal = getWizardSummaryTotal(summaryState, 5)
  const summaryCta = getWizardSummaryCta(summaryState, 5)
  const isSubmitDisabled = summaryCta.disabled || mutation.isPending

  // El profesional a mostrar en la tarjeta es SIEMPRE el resuelto en el hueco
  // (`selectedSlotEmployeeId`), no "Sin preferencia": a estas alturas la cita
  // ya tiene a alguien concreto asignado, tanto si se eligio a mano como si
  // lo resolvio la disponibilidad agregada. Cae en `selectedEmployee` solo
  // mientras `useEmployees` sigue en vuelo y la lista todavia no lo trae.
  const resolvedEmployee =
    employees.find((candidate) => candidate.id === selectedSlotEmployeeId) ?? selectedEmployee ?? null
  const employeeName = resolvedEmployee ? `${resolvedEmployee.firstName} ${resolvedEmployee.lastName}` : ""
  const rawPaletteIndex = resolvedEmployee ? employeePaletteIndex(employees, resolvedEmployee.id) : -1
  const fallbackPaletteIndex = rawPaletteIndex === -1 ? 0 : rawPaletteIndex
  const employeeDotColor = resolvedEmployee
    ? employeeSolidColor(resolvedEmployee.colorHex, fallbackPaletteIndex)
    : undefined

  const clientDisplayName = selectedClient
    ? `${selectedClient.firstName} ${selectedClient.lastName}`
    : newClientData
      ? `${newClientData.firstName} ${newClientData.lastName}`
      : ""
  const clientPhone = selectedClient?.phone ?? newClientData?.phone ?? ""

  const timeRangeDisplay =
    selectedSlot && selectedService ? formatWizardTimeRange(selectedSlot, selectedService.durationMinutes) : ""
  // `formatDateLong` da "Miercoles, 28 de agosto" CON tilde (capitaliza el dia
  // que date-fns devuelve en minuscula) -- los artboards escriben "Miercoles"
  // sin ella por convencion de dibujo, no porque el texto real vaya sin acento.
  const dateLongDisplay = selectedDate ? formatDateLong(selectedDate) : ""
  const durationDisplay = selectedService ? formatDurationTight(selectedService.durationMinutes) : ""

  const errorNote = mutation.isError ? (
    <p className="text-center text-xs text-destructive">{SUBMIT_ERROR_MESSAGE}</p>
  ) : null

  const aside = (
    <WizardSummaryAside
      heading="Resumen"
      rows={summaryRows}
      total={summaryTotal}
      ctaLabel={mutation.isPending ? "Creando cita..." : summaryCta.label}
      ctaDisabled={isSubmitDisabled}
      onCtaClick={() => mutation.mutate()}
      note={errorNote}
    />
  )

  const footer = (
    <>
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] leading-tight text-muted-foreground">Total</span>
        <span className="font-heading text-2xl font-semibold tabular-nums tracking-display">
          {summaryTotal ?? ""}
        </span>
      </div>
      <Button size="2xl" onClick={() => mutation.mutate()} disabled={isSubmitDisabled}>
        <Check className="size-[18px]" strokeWidth={2.25} />
        {mutation.isPending ? "Creando cita..." : "Crear cita"}
      </Button>
      {errorNote}
    </>
  )

  const badge = isDesktop ? (
    <span className="shrink-0 rounded-full bg-status-pending-bg px-2.5 py-1 text-[11px] leading-tight font-semibold text-status-pending-text">
      Se creara como Pendiente
    </span>
  ) : (
    <span className="shrink-0 rounded-full bg-status-pending-bg px-[9px] py-[3px] text-[10px] leading-tight font-semibold whitespace-nowrap text-status-pending-text">
      Pendiente
    </span>
  )

  const card = isDesktop ? (
    <div className="flex flex-col gap-[18px] rounded-xl border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-4 border-b border-hairline pb-4">
        <div className="flex flex-col gap-[3px]">
          <span className="font-heading text-[30px] leading-[1.05] font-semibold tracking-display tabular-nums">
            {timeRangeDisplay}
          </span>
          <span className="text-sm leading-tight text-muted-foreground">{dateLongDisplay}</span>
        </div>
        {badge}
      </div>

      <div className="grid grid-cols-3 gap-5">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground-2">Cliente</span>
          <span className="text-[15px] leading-tight font-semibold">{clientDisplayName}</span>
          {clientPhone && <span className="text-xs tabular-nums text-muted-foreground">{clientPhone}</span>}
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground-2">Profesional</span>
          <div className="flex items-center gap-[7px]">
            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: employeeDotColor }} />
            <span className="text-[15px] leading-tight">{employeeName}</span>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground-2">Servicio</span>
          <span className="text-[15px] leading-tight">{selectedService?.name}</span>
          {selectedService && (
            <span className="text-xs tabular-nums text-muted-foreground">{durationDisplay}</span>
          )}
        </div>
      </div>
    </div>
  ) : (
    <div className="flex flex-col gap-[14px] rounded-xl border border-border bg-card p-4">
      <div className="flex items-baseline justify-between gap-3 border-b border-hairline pb-[14px]">
        <div className="flex flex-col gap-0.5">
          <span className="font-heading text-[26px] leading-[1.1] font-semibold tracking-display tabular-nums">
            {timeRangeDisplay}
          </span>
          <span className="text-[13px] leading-tight text-muted-foreground">{dateLongDisplay}</span>
        </div>
        {badge}
      </div>

      <ConfirmationLine label="Cliente">
        <span className="text-sm font-semibold">{clientDisplayName}</span>
        {clientPhone && <span className="text-xs tabular-nums text-muted-foreground">{clientPhone}</span>}
      </ConfirmationLine>

      <ConfirmationLine label="Profesional">
        <div className="flex items-center gap-[7px]">
          <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: employeeDotColor }} />
          <span className="text-sm">{employeeName}</span>
        </div>
      </ConfirmationLine>

      <ConfirmationLine label="Servicio">
        <span className="text-sm">{selectedService?.name}</span>
        {selectedService && <span className="text-xs tabular-nums text-muted-foreground">{durationDisplay}</span>}
      </ConfirmationLine>
    </div>
  )

  const notesBlock = (
    <div className={cn("flex flex-col", isDesktop ? "gap-1.5" : "gap-2")}>
      <span className="text-xs font-semibold text-muted-foreground">Notas para el profesional</span>
      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notas (opcional)"
        className={cn(
          "resize-none rounded-lg px-3.5 py-3",
          isDesktop ? "h-[90px] text-sm leading-tight" : "h-[76px] text-[13px] leading-tight"
        )}
      />
    </div>
  )

  return (
    <NewAppointmentShell
      step={5}
      title="Confirma la cita"
      subtitle="Revisa antes de crearla en la agenda."
      onBack={onBack}
      onClose={onClose}
      aside={aside}
      footer={footer}
    >
      {card}
      {notesBlock}
    </NewAppointmentShell>
  )
}

function ConfirmationLine({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-[74px] shrink-0 text-xs text-muted-foreground-2">{label}</span>
      <div className="flex flex-col gap-px">{children}</div>
    </div>
  )
}
