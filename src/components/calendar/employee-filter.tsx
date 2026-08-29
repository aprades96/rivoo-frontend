"use client"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { initials } from "@/lib/utils/format"
import { employeeFallbackAvatarClassName } from "./employee-column-header"
import type { Employee } from "@/types/employee"

interface EmployeeFilterProps {
  employees: Employee[]
  selectedId: string | null
  onSelect: (id: string | null) => void
}

// Pildoras de 34px de alto (Calendario.dc.html:51-62).
const PILL_BASE =
  "flex h-[34px] shrink-0 items-center rounded-full border text-xs transition-colors"
const PILL_SELECTED =
  "border-primary bg-primary font-semibold text-primary-foreground"
// La pildora en reposo va en BLANCO (`Calendario.dc.html:51,56,60`), no en el
// `#FBF7F2` del fondo de pagina: con `bg-background` se confundia con la hoja
// y solo sobrevivia el contorno. `bg-card` = #FFFFFF.
const PILL_IDLE = "border-border bg-card font-medium hover:bg-muted"

/**
 * Filtro de agenda por empleado. SOLO MOVIL (Calendario.dc.html:50-63): en
 * escritorio la rejilla dibuja una columna por empleado, asi que este filtro
 * ni se dibuja ni se monta. La fila trae su propio padding (12px 16px) porque
 * en el artboard va a sangre y las pildoras se desplazan bajo el borde.
 */
export function EmployeeFilter({ employees, selectedId, onSelect }: EmployeeFilterProps) {
  return (
    <ScrollArea className="w-full">
      <div className="flex gap-1.5 px-4 py-3">
        {/* All employees pill */}
        <button
          onClick={() => onSelect(null)}
          className={cn(
            PILL_BASE,
            "px-3.5",
            selectedId === null ? PILL_SELECTED : PILL_IDLE
          )}
        >
          Todos
        </button>

        {employees.filter((e) => e.isActive).map((emp, index) => {
          const isSelected = selectedId === emp.id
          return (
            <button
              key={emp.id}
              onClick={() => onSelect(emp.id)}
              className={cn(
                PILL_BASE,
                "gap-[7px] pr-3 pl-[5px]",
                isSelected ? PILL_SELECTED : PILL_IDLE
              )}
            >
              {/* `after:hidden` apaga el aro #E7DCCF que `Avatar` pinta por
                  defecto (`ui/avatar.tsx:20`): el artboard dibuja estos avatares
                  de 24px SIN borde (`Calendario.dc.html:53,57,61`), igual que la
                  cabecera de escritorio. Se apaga aqui y no en la primitiva,
                  que la comparten otras pantallas. */}
              <Avatar className="size-6 after:hidden">
                <AvatarFallback
                  className={cn(
                    "text-[9px] font-bold",
                    // Sin color propio, el mismo color de reserva que le da la
                    // cabecera de columna en escritorio. Sin esto mandaba el gris
                    // de `AvatarFallback` y el empleado salia de color arriba y
                    // gris en su pildora.
                    !isSelected && !emp.colorHex && employeeFallbackAvatarClassName(index),
                    isSelected && "bg-white/22 text-primary-foreground"
                  )}
                  style={
                    emp.colorHex && !isSelected
                      ? { backgroundColor: emp.colorHex + "20", color: emp.colorHex }
                      : undefined
                  }
                >
                  {initials(emp.firstName, emp.lastName)}
                </AvatarFallback>
              </Avatar>
              {emp.firstName}
            </button>
          )
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  )
}
