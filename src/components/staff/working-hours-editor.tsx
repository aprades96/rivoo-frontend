"use client"

import { forwardRef, useImperativeHandle, useState } from "react"
import { Loader2, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import type { WorkingHoursResponse, WorkingHoursRequest } from "@/types/employee"

const DAY_NAMES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]

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
  "h-9 flex-1 rounded-lg border-border bg-card px-[10px] text-[13px] leading-none font-medium tabular-nums md:w-[92px] md:flex-none",
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

// D13: a day is incomplete the moment it is open and EITHER time is still
// blank -- one empty field is already enough, it does not take both. This is
// the far more likely mistake (writing the opening time and forgetting the
// closing one), and reading it as "neither" would let that case slip past
// the freeze below. `!value` covers both `""` and `null`/`undefined` on
// purpose: `src/types/employee.ts` types `openTime`/`closeTime` as a
// non-nullable `string`, but the backend writes `null` for Saturday/Sunday
// on a freshly created employee (EmployeeService.java) -- the type lies, so
// the runtime check has to treat the field as nullable regardless of what
// TypeScript believes.
function isIncomplete(day: WorkingHoursRequest): boolean {
  return day.isOpen && (!day.openTime || !day.closeTime)
}

// LOW: a closed day can still carry a previously stored schedule (the owner
// toggled it off without clearing the times) -- claiming "sin horas
// guardadas" for THAT day would assert something about the database this
// component never checked. The suffix is only true when both times are
// genuinely absent.
function hasStoredHours(day: WorkingHoursRequest): boolean {
  return !!day.openTime && !!day.closeTime
}

function closedLabel(day: WorkingHoursRequest): string {
  return hasStoredHours(day) ? "Cerrado" : "Cerrado · sin horas guardadas"
}

// LOW: the banner used to hard-code "El domingo" regardless of which day (or
// days) were actually incomplete. A freshly created employee has BOTH
// Saturday and Sunday unset; opening Saturday alone already produces two
// incomplete days at once, and the old copy silently ignored the first one.
// Names every incomplete day, not just one.
function incompleteDaysMessage(days: WorkingHoursRequest[]): string {
  const names = days.filter(isIncomplete).map((d) => `el ${DAY_NAMES[d.dayOfWeek - 1].toLowerCase()}`)
  if (names.length === 0) return ""
  const joined = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`
  const subject = joined.charAt(0).toUpperCase() + joined.slice(1)
  const verb = names.length === 1 ? "llega" : "llegan"
  const pronoun = names.length === 1 ? "activarlo" : "activarlos"
  return `${subject} ${verb} sin horas guardadas. Al ${pronoun} hay que escribirlas antes de guardar.`
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

    // `save()` is the imperative escape hatch used by settings/business-hours
    // and (onboarding)/business-hours (`showSaveButton={false}`, D13). It
    // forwards to `onSave` UNCONDITIONALLY, on purpose: those two screens'
    // `handleContinue` is `try { await save(); router.push(...) } catch {}`,
    // and their toast is thrown by `mutation.onError`, which only runs if the
    // mutation actually starts. If this method refused to call `onSave` on an
    // incomplete day, the mutation would never run, `onError` would never
    // fire, and the `catch {}` would swallow the rejection silently -- the
    // user would press "Continuar" and nothing would happen at all: no
    // navigation, no toast, no message. The freeze below therefore lives
    // ONLY on the internal button's `disabled`, never here. Do not "fix" this
    // by making `save()` reject too -- see D13 in the block plan.
    useImperativeHandle(ref, () => ({
      save: () => onSave(localHours),
    }))

    const hasIncompleteDay = localHours.some(isIncomplete)

    return (
      <div>
        {/* H5: each day is its own bordered/rounded card, stacked with an 8px
            gap -- NOT one shared container sliced by hairline separators
            (`DetalleEmpleado.dc.html:19,29,93`, `DetalleEmpleadoDesktop.dc.html:29,152`).
            Row order is [toggle][day][hours] (`DetalleEmpleado.dc.html:95-97`),
            height 52px mobile / 44px desktop, day label 74px / 78px. */}
        <div className="flex flex-col gap-2">
          {localHours.map((day) => {
            const dayLabel = DAY_NAMES[day.dayOfWeek - 1]
            const incomplete = isIncomplete(day)
            return (
              <div
                key={day.dayOfWeek}
                className={cn(
                  "flex h-[52px] items-center gap-2.5 rounded-lg border border-border bg-card px-2.5 md:h-11 md:gap-[10px]",
                  !day.isOpen && "bg-muted-subtle",
                  incomplete && "border-surface-now-border bg-surface-now"
                )}
              >
                <Switch
                  checked={day.isOpen}
                  onCheckedChange={(checked) => updateDay(day.dayOfWeek, "isOpen", checked)}
                  disabled={isSaving}
                  aria-label={`Abierto ${dayLabel}`}
                />
                <span
                  className={cn(
                    "w-[74px] shrink-0 text-sm font-semibold md:w-[78px]",
                    !day.isOpen && "text-muted-foreground-2"
                  )}
                >
                  {dayLabel}
                </span>

                {day.isOpen ? (
                  <div className="flex flex-1 items-center gap-2 md:gap-[9px]">
                    <Input
                      type="time"
                      value={day.openTime ?? ""}
                      placeholder="--:--"
                      onChange={(e) => updateDay(day.dayOfWeek, "openTime", e.target.value)}
                      disabled={isSaving}
                      className={cn(
                        TIME_INPUT_CLASS_NAME,
                        incomplete && "border-input-border-attention text-text-subtle"
                      )}
                      aria-label={`Hora de apertura, ${dayLabel}`}
                    />
                    <span className="text-xs text-muted-foreground-2">a</span>
                    <Input
                      type="time"
                      value={day.closeTime ?? ""}
                      placeholder="--:--"
                      onChange={(e) => updateDay(day.dayOfWeek, "closeTime", e.target.value)}
                      disabled={isSaving}
                      className={cn(
                        TIME_INPUT_CLASS_NAME,
                        incomplete && "border-input-border-attention text-text-subtle"
                      )}
                      aria-label={`Hora de cierre, ${dayLabel}`}
                    />
                  </div>
                ) : (
                  <span className="text-xs text-text-subtle">{closedLabel(day)}</span>
                )}
              </div>
            )
          })}
        </div>

        {/* D13: informational in the three consumers; only this component's
            OWN button (below) refuses to submit while it is showing. */}
        {hasIncompleteDay && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-border bg-muted p-[10px_12px]">
            <Info className="mt-px h-[15px] w-[15px] shrink-0 text-muted-foreground" strokeWidth={1.75} />
            <span className="text-xs leading-[1.45] text-muted-foreground">
              {incompleteDaysMessage(localHours)}
            </span>
          </div>
        )}

        {showSaveButton && (
          <Button
            size="xl"
            className="mt-3 h-[46px] w-full md:h-10 md:text-sm"
            onClick={() => onSave(localHours)}
            disabled={isSaving || hasIncompleteDay}
          >
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar horarios
          </Button>
        )}
      </div>
    )
  }
)
