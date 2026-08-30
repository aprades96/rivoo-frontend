import { Button } from "@/components/ui/button"
import { DataTable, type DataTableColumn } from "@/components/ui/data-table"
import { EmptyState } from "@/components/shared/empty-state"
import { LoadingSkeleton } from "@/components/shared/loading-skeleton"
import { StatusBadge } from "@/components/appointments/status-badge"
import { useClientAppointments } from "@/hooks/use-clients"
import { formatCurrency } from "@/lib/utils/format"
import { formatDate } from "@/lib/utils/dates"
import { cn } from "@/lib/utils"
import type { AppointmentStatus } from "@/types/appointment"
import type { ClientAppointment } from "@/types/client"

// B3: el endpoint sirve `size=7` por defecto y ordena `startTime DESC`. Una
// SOLA consulta alimenta los dos anchos (D24): escritorio pinta las 7 filas,
// movil solo las 3 primeras.
const HISTORY_PAGE_SIZE = 7
const MOBILE_VISIBLE_COUNT = 3

// D25: el importe de una cita que no se cobro se atenua, en los DOS anchos --
// no es un desliz de un solo artboard, es informacion (D25).
function isUnpaidStatus(status: string): boolean {
  return status === "NO_SHOW" || status === "CANCELLED"
}

const COLUMNS: DataTableColumn<ClientAppointment>[] = [
  {
    key: "date",
    header: "Fecha",
    width: "132px",
    cell: (appointment) => (
      <span className="font-semibold text-[13px] leading-none tabular-nums">
        {formatDate(appointment.startTime)}
      </span>
    ),
  },
  {
    key: "service",
    header: "Servicio",
    width: "minmax(0,1fr)",
    cell: (appointment) => <span className="truncate text-sm">{appointment.serviceName}</span>,
  },
  {
    key: "employee",
    header: "Profesional",
    width: "150px",
    cell: (appointment) => (
      <span className="truncate text-[13px] leading-tight text-muted-foreground">
        {appointment.employeeName}
      </span>
    ),
  },
  {
    key: "price",
    header: "Importe",
    width: "86px",
    align: "end",
    cell: (appointment) => (
      <span
        className={cn(
          "font-semibold text-[14px] leading-tight tabular-nums",
          isUnpaidStatus(appointment.status) && "text-muted-foreground-2"
        )}
      >
        {formatCurrency(appointment.price)}
      </span>
    ),
  },
  {
    key: "status",
    header: "Estado",
    width: "108px",
    cell: (appointment) => <StatusBadge status={appointment.status as AppointmentStatus} />,
  },
]

interface ClientAppointmentHistoryProps {
  clientId: string
  isDesktop: boolean
}

/**
 * `DetalleCliente(Desktop).dc.html` (D23, D24, D25, D36, D38). Una sola
 * consulta (`useClientAppointments`, `size=7` de B3) alimenta las dos
 * anchuras: escritorio pinta las 7 filas en una `DataTable` anidada
 * (`variant="nested"`, D4), movil solo las 3 primeras a modo de lista
 * simple, SIN volver a pedir el historial.
 *
 * El endpoint de B3 NO se traga los errores (a diferencia de `/export`): un
 * fallo se propaga y aqui se pinta una rama de error propia -- "sin citas" y
 * "no se pudo cargar" no pueden verse iguales (D38).
 */
export function ClientAppointmentHistory({ clientId, isDesktop }: ClientAppointmentHistoryProps) {
  const { data, isLoading, isError, refetch } = useClientAppointments(clientId, {
    size: HISTORY_PAGE_SIZE,
  })

  if (isLoading) {
    return <LoadingSkeleton count={3} />
  }

  if (isError) {
    return (
      <EmptyState
        title="No se ha podido cargar el historial"
        description="Comprueba tu conexion e intentalo de nuevo."
        action={<Button onClick={() => refetch()}>Reintentar</Button>}
      />
    )
  }

  const summary = data?.summary
  const appointments = data?.content ?? []
  const totalElements = data?.totalElements ?? 0
  // D25: `12px` uppercase 700, mismo rotulo que el resto de secciones (`.sec`).
  const heading = (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-[11px] leading-none font-bold tracking-[0.08em] text-muted-foreground-2 uppercase">
        Historial de citas
      </h2>
      {summary && (
        <span className="text-xs leading-tight tabular-nums text-muted-foreground-2">
          {summary.totalAppointments} citas &middot; {formatCurrency(summary.billedAmount)} facturados
        </span>
      )}
    </div>
  )

  // D23: sin citas se pinta SOLO la cabecerilla -- ni tabla, ni footer, ni
  // copy inventado.
  if (appointments.length === 0) {
    return <div className="flex flex-col gap-2">{heading}</div>
  }

  const visibleOnMobile = appointments.slice(0, MOBILE_VISIBLE_COUNT)

  return (
    <div className="flex flex-col gap-2">
      {heading}

      {isDesktop ? (
        <DataTable
          columns={COLUMNS}
          rows={appointments}
          rowKey={(appointment) => appointment.id}
          variant="nested"
          rowHeight={58}
          gap={12}
          caption="Historial de citas"
          footer={<HistoryFooter shown={appointments.length} total={totalElements} />}
        />
      ) : (
        <div className="flex flex-col gap-2">
          <div className="overflow-hidden rounded-[10px] border border-border bg-card">
            {visibleOnMobile.map((appointment, index) => (
              <div key={appointment.id}>
                <MobileHistoryRow appointment={appointment} />
                {index < visibleOnMobile.length - 1 && <div className="ml-3.5 h-px bg-hairline" />}
              </div>
            ))}
          </div>
          {/* D24: el movil ensena 3 de {totalElements} citas y su artboard NO
              dibuja footer -- sin el, la pantalla afirmaria por omision que el
              cliente ha venido solo esas 3 veces. El texto se REUSA del
              escritorio, no se inventa (D23 exception). El enlace "Ver todas"
              NO se monta: su destino no existe. */}
          <HistoryFooter shown={visibleOnMobile.length} total={totalElements} />
        </div>
      )}
    </div>
  )
}

function HistoryFooter({ shown, total }: { shown: number; total: number }) {
  return (
    <p className="px-1 text-xs leading-tight tabular-nums text-muted-foreground-2">
      Mostrando {shown} de {total} citas
    </p>
  )
}

function MobileHistoryRow({ appointment }: { appointment: ClientAppointment }) {
  return (
    <div className="flex items-start justify-between gap-3 px-3.5 py-2.5">
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="truncate text-sm leading-tight font-semibold tabular-nums">
          {formatDate(appointment.startTime)} &middot; {appointment.serviceName}
        </p>
        <p
          className={cn(
            "truncate text-xs leading-tight tabular-nums text-muted-foreground",
            isUnpaidStatus(appointment.status) && "text-muted-foreground-2"
          )}
        >
          {appointment.employeeName} &middot; {formatCurrency(appointment.price)}
        </p>
      </div>
      <StatusBadge status={appointment.status as AppointmentStatus} className="mt-0.5 shrink-0 text-[10px]" />
    </div>
  )
}
