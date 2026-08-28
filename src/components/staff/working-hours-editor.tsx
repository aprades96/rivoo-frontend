"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { WorkingHoursResponse, WorkingHoursRequest } from "@/types/employee"

const DAY_NAMES = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"]

const DEFAULT_HOURS: WorkingHoursRequest[] = Array.from({ length: 7 }, (_, i) => ({
  dayOfWeek: i + 1,
  isOpen: i < 5, // Mon-Fri open by default
  openTime: "09:00",
  closeTime: "20:00",
}))

interface WorkingHoursEditorProps {
  hours: WorkingHoursResponse[] | undefined
  onSave: (hours: WorkingHoursRequest[]) => Promise<unknown>
  isSaving?: boolean
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

export function WorkingHoursEditor({ hours, onSave, isSaving }: WorkingHoursEditorProps) {
  const [localHours, setLocalHours] = useState<WorkingHoursRequest[]>(
    () => hoursStateFrom(hours)
  )

  // Adopt the stored schedule once, when it first arrives. Later refetches
  // return a new array for the same owner and must not discard the times the
  // user is editing; a different owner gets a fresh editor via `key` at the call
  // site (the props carry no owner identity of their own).
  const syncKey = !!hours && hours.length > 0
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

  return (
    <div className="space-y-3">
      {localHours.map((day) => (
        <div key={day.dayOfWeek} className="flex items-center gap-2 rounded-lg border p-2">
          <label className="flex w-20 shrink-0 cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={day.isOpen}
              onChange={(e) => updateDay(day.dayOfWeek, "isOpen", e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            <span className={`text-xs font-medium ${day.isOpen ? "" : "text-muted-foreground"}`}>
              {DAY_NAMES[day.dayOfWeek - 1]}
            </span>
          </label>

          {day.isOpen ? (
            <div className="flex flex-1 items-center gap-1">
              <Input
                type="time"
                value={day.openTime}
                onChange={(e) => updateDay(day.dayOfWeek, "openTime", e.target.value)}
                className="h-8 text-xs"
              />
              <span className="text-xs text-muted-foreground">-</span>
              <Input
                type="time"
                value={day.closeTime}
                onChange={(e) => updateDay(day.dayOfWeek, "closeTime", e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">Cerrado</span>
          )}
        </div>
      ))}

      <Button
        className="w-full"
        onClick={() => onSave(localHours)}
        disabled={isSaving}
      >
        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Guardar horarios
      </Button>
    </div>
  )
}
