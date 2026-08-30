import { Badge } from "@/components/ui/badge"
import type { AppointmentStatus } from "@/types/appointment"

// Fuente unica de los rotulos de estado y sus tokens. Se exporta porque
// `appointment-detail-facts.ts` (T4) lo reutiliza para el badge del detalle en
// vez de forkear el mapa (mismo motivo que D12 evita duplicar la paleta de
// colores). `longLabel` es la unica adicion: la variante larga de escritorio
// del artboard ("Pendiente de confirmar", `DetalleCitaDesktop.dc.html:259`).
// Ningun rotulo EXISTENTE cambia: lo consumen `appointment-card.tsx` y
// `src/app/dev/preview/page.tsx` ademas de este propio fichero.
export const statusConfig: Record<
  AppointmentStatus,
  { label: string; longLabel?: string; className: string }
> = {
  PENDING: {
    label: "Pendiente",
    longLabel: "Pendiente de confirmar",
    className: "bg-(--color-status-pending-bg) text-(--color-status-pending-text) hover:bg-(--color-status-pending-bg)",
  },
  CONFIRMED: {
    label: "Confirmada",
    className: "bg-(--color-status-confirmed-bg) text-(--color-status-confirmed-text) hover:bg-(--color-status-confirmed-bg)",
  },
  IN_PROGRESS: {
    label: "En curso",
    className: "bg-(--color-status-in-progress-bg) text-(--color-status-in-progress-text) hover:bg-(--color-status-in-progress-bg)",
  },
  COMPLETED: {
    label: "Completada",
    className: "bg-(--color-status-completed-bg) text-(--color-status-completed-text) hover:bg-(--color-status-completed-bg)",
  },
  CANCELLED: {
    label: "Cancelada",
    className: "bg-(--color-status-cancelled-bg) text-(--color-status-cancelled-text) hover:bg-(--color-status-cancelled-bg)",
  },
  NO_SHOW: {
    label: "No asistió",
    className: "bg-(--color-status-no-show-bg) text-(--color-status-no-show-text) hover:bg-(--color-status-no-show-bg)",
  },
}

interface StatusBadgeProps {
  status: AppointmentStatus
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status]
  return (
    <Badge variant="secondary" className={`${config.className} ${className ?? ""}`}>
      {config.label}
    </Badge>
  )
}
