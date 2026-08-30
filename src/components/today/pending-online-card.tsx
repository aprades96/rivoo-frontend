"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { formatTime } from "@/lib/utils/dates"
import type { Appointment } from "@/types/appointment"

interface PendingOnlineCardProps {
  // D22: ya llegan filtradas por `getPendingOnline` (`today-facts.ts`) --
  // `status === "PENDING" && source === "ONLINE"`. Este componente NO vuelve
  // a filtrar: si se le pasa una cita de mostrador, la cuenta igual.
  appointments: Appointment[]
}

// Enumeracion legible para 1, 2 o 3+ nombres: "A", "A y B", "A, B y C".
function joinNames(parts: string[]): string {
  if (parts.length <= 1) return parts.join("")
  if (parts.length === 2) return `${parts[0]} y ${parts[1]}`
  return `${parts.slice(0, -1).join(", ")} y ${parts[parts.length - 1]}`
}

// Solo existe en escritorio (D17, `HoyDesktop.dc.html:230-234`): el artboard
// movil no la dibuja. La decision de no montarla en movil es de la pagina
// (T8), no de este componente.
export function PendingOnlineCard({ appointments }: PendingOnlineCardProps) {
  const router = useRouter()

  // Sin reservas online pendientes no hay nada que dibujar -- el artboard no
  // contempla un estado vacio para esta tarjeta.
  if (appointments.length === 0) return null

  const count = appointments.length
  const title =
    count === 1 ? "1 reserva online sin confirmar" : `${count} reservas online sin confirmar`
  const verb = count === 1 ? "esta" : "estan"
  const names = joinNames(appointments.map((a) => `${a.clientName} (${formatTime(a.startTime)})`))
  const body = `${names} ${verb} esperando respuesta del salon.`

  return (
    <div
      data-testid="pending-online-card"
      className="flex flex-col gap-2 rounded-[10px] border border-(--color-warning-border) bg-(--color-warning-soft) p-4"
    >
      <span className="text-[13px] leading-none font-semibold text-(--color-status-pending-text)">
        {title}
      </span>
      <span className="text-[12px] leading-normal text-muted-foreground">{body}</span>
      <Button
        size="action"
        // `size="action"` trae `px-[18px]` y `text-sm` (14px, `button.tsx:35`);
        // el artboard dibuja `padding 0 16px` y 13px -- se pisan aqui via
        // className en vez de tocar `button.tsx`, que comparten muchas
        // pantallas. La altura de 38px de `size="action"` si coincide.
        className="mt-1 w-full px-4 text-[13px] leading-none"
        // D24: el CTA navega a /calendar, donde se confirman las citas de hoy
        // (panel de detalle con "Confirmar"). Ningun artboard dibuja este
        // destino -- es decision de producto, no del canvas. No se construye
        // aqui una pantalla de confirmacion en lote: no existe el endpoint.
        onClick={() => router.push("/calendar")}
      >
        Revisar y confirmar
      </Button>
    </div>
  )
}
