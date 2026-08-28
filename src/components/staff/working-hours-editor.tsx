"use client"

import { forwardRef, useImperativeHandle, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import type { WorkingHoursResponse, WorkingHoursRequest } from "@/types/employee"

const DAY_NAMES = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"]

const DEFAULT_HOURS: WorkingHoursRequest[] = Array.from({ length: 7 }, (_, i) => ({
  dayOfWeek: i + 1,
  isOpen: i < 5, // Mon-Fri open by default
  openTime: "09:00",
  closeTime: "20:00",
}))

// design/Onboarding2.dc.html:34 (mobile) and Onboarding2Desktop.dc.html:36
// (desktop) -- 36px, 10px horizontal padding, --border, 8px radius, white,
// 13px/500, tabular-nums. Chrome/Edge paint their own clock icon and "x"
// clear button on a native <input type="time">; neither is drawn on the
// artboard, so both are hidden via their vendor pseudo-elements. Firefox
// does not render a picker icon on this input type, so it needs no
// equivalent rule. The control stays a native time input (not a custom
// widget) precisely so it keeps full keyboard support (typing digits,
// arrow keys to step, Tab to move between the hour/minute segments).
const TIME_INPUT_CLASS_NAME = cn(
  "h-9 flex-1 rounded-lg border-border bg-white px-[10px] text-[13px] font-medium tabular-nums md:w-[92px] md:flex-none",
  "[&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-clear-button]:hidden [&::-webkit-inner-spin-button]:hidden"
)

interface WorkingHoursEditorProps {
  hours: WorkingHoursResponse[] | undefined
  onSave: (hours: WorkingHoursRequest[]) => Promise<unknown>
  isSaving?: boolean
  /**
   * The assistant hides this: its own footer "Continuar" already saves and
   * navigates (see business-hours/page.tsx). Defaults to true so settings,
   * the other consumer, keeps its current behaviour untouched.
   */
  showSaveButton?: boolean
}

// Imperative escape hatch for the assistant's own "Continuar" (business-hours/
// page.tsx), which lives outside this component and has no other way to reach
// localHours -- lifting that state up would mean touching the sync block
// below, which is explicitly off-limits. `save()` just forwards to the same
// `onSave` the internal button calls.
export interface WorkingHoursEditorHandle {
  save: () => Promise<unknown>
}

function hoursStateFrom(hours: WorkingHoursResponse[] | undefined): WorkingHoursRequest[] {
  if (!hours || hours.length === 0) return DEFAULT_HOURS
  return hours.map((h) => ({
    dayOfWeek: h.dayOfWeek,
    isOpen: h.isOpen,
    openTime: h.openTime,
    closeTime: h.closeTime,
    breakStartTime: h.breakStartTime ?? undefined,
    breakEndTime: h.breakEndTime ?? undefined,
  }))
}

export const WorkingHoursEditor = forwardRef<WorkingHoursEditorHandle, WorkingHoursEditorProps>(
  function WorkingHoursEditor({ hours, onSave, isSaving, showSaveButton = true }, ref) {
    const [localHours, setLocalHours] = useState<WorkingHoursRequest[]>(
      () => hoursStateFrom(hours)
    )

    // Adopt the stored schedule the first time it arrives, where "arrives" means
    // the prop stops being undefined -- not the array stops being empty. An empty
    // payload is itself an answer (this owner has no stored schedule) and maps to
    // DEFAULT_HOURS. Keying on non-emptiness would flip late instead: a fresh
    // salon answers [], and the post-save refetch that finally returns rows would
    // discard whatever the user had typed in between. Later refetches keep the
    // prop defined, so they never touch local state; a different owner gets a
    // fresh editor via `key` at the call site (the props carry no owner identity
    // of their own).
    const syncKey = hours !== undefined
    const [syncedKey, setSyncedKey] = useState(syncKey)
    if (syncKey !== syncedKey) {
      setSyncedKey(syncKey)
      setLocalHours(hoursStateFrom(hours))
    }

    const updateDay = (dayOfWeek: number, field: string, value: string | boolean) => {
      setLocalHours((prev) =>
        prev.map((h) =>
          h.dayOfWeek === dayOfWeek ? { ...h, [field]: value } : h
        )
      )
    }

    useImperativeHandle(ref, () => ({
      save: () => onSave(localHours),
    }))

    return (
      <div>
        <div className="flex flex-col">
          {localHours.map((day, index) => {
            const dayLabel = DAY_NAMES[day.dayOfWeek - 1]
            return (
              <div key={day.dayOfWeek}>
                {index > 0 && <div className="h-px bg-hairline" />}

                {day.isOpen ? (
                  <div className="flex flex-col gap-[9px] py-3 px-[14px] md:grid md:grid-cols-[130px_52px_1fr] md:items-center md:gap-4 md:py-[11px] md:px-[14px]">
                    <div className="flex items-center justify-between md:contents">
                      <span className="text-sm font-semibold">{dayLabel}</span>
                      <Switch
                        checked={day.isOpen}
                        onCheckedChange={(checked) => updateDay(day.dayOfWeek, "isOpen", checked)}
                        disabled={isSaving}
                        aria-label={`Abierto ${dayLabel}`}
                      />
                    </div>
                    <div className="flex items-center gap-2 md:gap-[9px]">
                      <Input
                        type="time"
                        value={day.openTime}
                        onChange={(e) => updateDay(day.dayOfWeek, "openTime", e.target.value)}
                        disabled={isSaving}
                        className={TIME_INPUT_CLASS_NAME}
                        aria-label={`Hora de apertura, ${dayLabel}`}
                      />
                      <span className="text-xs text-muted-foreground-2">a</span>
                      <Input
                        type="time"
                        value={day.closeTime}
                        onChange={(e) => updateDay(day.dayOfWeek, "closeTime", e.target.value)}
                        disabled={isSaving}
                        className={TIME_INPUT_CLASS_NAME}
                        aria-label={`Hora de cierre, ${dayLabel}`}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between bg-muted-subtle p-[14px]">
                    <div className="flex items-center gap-2.5">
                      <span className="text-sm font-semibold text-muted-foreground-2">
                        {dayLabel}
                      </span>
                      <span className="text-xs text-text-subtle">Cerrado</span>
                    </div>
                    <Switch
                      checked={day.isOpen}
                      onCheckedChange={(checked) => updateDay(day.dayOfWeek, "isOpen", checked)}
                      disabled={isSaving}
                      aria-label={`Abierto ${dayLabel}`}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {showSaveButton && (
          <Button
            className="mt-3 w-full"
            onClick={() => onSave(localHours)}
            disabled={isSaving}
          >
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar horarios
          </Button>
        )}
      </div>
    )
  }
)
