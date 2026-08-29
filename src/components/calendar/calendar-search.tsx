"use client"

import { useState } from "react"
import { Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { Appointment } from "@/types/appointment"

export type CalendarSearchVariant = "desktop" | "mobile"

/**
 * El boton plegado, con la talla que dibuja cada artboard: 38x38 en la barra
 * superior de escritorio (`design/CalendarioDesktop.dc.html:95`) y 36x36 en la
 * cabecera movil (`design/Calendario.dc.html:28`).
 */
const TRIGGER_CLASSNAME: Record<CalendarSearchVariant, string> = {
  desktop: "size-[38px]",
  mobile: "size-9",
}

/**
 * El campo desplegado. El alto lo iguala al del boton que sustituye para que
 * la cabecera no de un salto al desplegarse; el ancho es el que cabe sin
 * empujar nada: en movil quedan ~358px utiles y el titulo "Citas" ocupa ~50.
 */
const FIELD_CLASSNAME: Record<CalendarSearchVariant, string> = {
  desktop: "h-[38px] w-[240px]",
  mobile: "h-9 w-[188px]",
}

interface CalendarSearchProps {
  /** El texto vigente. El filtrado lo hace la pantalla, no este componente. */
  value: string
  onChange: (value: string) => void
  variant: CalendarSearchVariant
  className?: string
}

/**
 * Buscador de la agenda: un boton que se convierte en campo al pulsarlo y
 * filtra EN CLIENTE las citas ya cargadas del dia visible (ver
 * `filterAppointmentsBySearch`). No toca la consulta: el dia entero cabe en
 * una pagina de 200 y volver al servidor por cada tecla pintaria la rejilla
 * vacia entre pulsacion y pulsacion.
 *
 * INVENCION ADMITIDA: el estado DESPLEGADO no esta dibujado en ningun
 * artboard -- los dos solo pintan el boton plegado. Se resuelve con las
 * primitivas del repo (`Input` + `Button variant="ghost"`) y sin tokens
 * nuevos, tomando del artboard lo unico que si esta medido: la talla del
 * boton, que el campo hereda como alto. Si el diseno dibuja algun dia este
 * estado, esto es lo primero que hay que recalibrar.
 *
 * `expanded` NO es solo `open`: tambien esta desplegado si hay texto. La
 * pantalla monta este componente en la cabecera de escritorio O en la de
 * movil, nunca en las dos (`PageShell` elige rama), asi que cruzar los
 * 1024px lo desmonta y lo vuelve a montar con `open` en `false`; sin la
 * segunda mitad de la condicion, la busqueda seguiria filtrando la rejilla
 * con el campo escondido y sin forma de vaciarlo.
 */
export function CalendarSearch({ value, onChange, variant, className }: CalendarSearchProps) {
  const [open, setOpen] = useState(false)
  const expanded = open || value.length > 0

  const collapse = () => {
    setOpen(false)
    // Plegar es cancelar: dejar el texto puesto esconderia el motivo por el
    // que faltan citas en la rejilla.
    onChange("")
  }

  if (!expanded) {
    return (
      <Button
        variant="outline"
        size="icon"
        aria-label="Buscar"
        onClick={() => setOpen(true)}
        className={cn(TRIGGER_CLASSNAME[variant], className)}
      >
        <Search className="size-[17px]" />
      </Button>
    )
  }

  return (
    // `onKeyDown` en el contenedor, no en el `Input`: Escape tiene que plegar
    // tambien con el foco en el aspa.
    <div
      className={cn("flex items-center gap-1.5", className)}
      onKeyDown={(event) => {
        if (event.key === "Escape") collapse()
      }}
    >
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="text"
          // Solo cuando lo ha abierto el usuario en ESTA instancia. Al
          // remontarse por un cambio de ancho `open` es `false`, y robar el
          // foco alli seria un salto que nadie ha pedido.
          autoFocus={open}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label="Buscar citas"
          placeholder="Cliente o servicio"
          className={cn("pl-8", FIELD_CLASSNAME[variant])}
        />
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Cerrar busqueda"
        onClick={collapse}
        className={TRIGGER_CLASSNAME[variant]}
      >
        <X className="size-4" />
      </Button>
    </div>
  )
}

/**
 * Minusculas y sin diacriticos: quien teclea "sofia" en el buscador espera
 * encontrar a "Sofía", y quien teclea "manicura" espera "Manicura".
 */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

/**
 * Filtra las citas del dia por nombre de CLIENTE o de SERVICIO, que son los
 * dos datos que el bloque de la rejilla pinta y por tanto los dos por los que
 * se busca lo que se ve. Una consulta vacia devuelve la lista tal cual (la
 * misma referencia: sin buscador activo no hay motivo para recalcular nada
 * aguas abajo).
 */
export function filterAppointmentsBySearch(
  appointments: Appointment[],
  query: string
): Appointment[] {
  const needle = normalize(query.trim())
  if (needle.length === 0) return appointments

  return appointments.filter(
    (appointment) =>
      normalize(appointment.clientName).includes(needle) ||
      normalize(appointment.serviceName).includes(needle)
  )
}
