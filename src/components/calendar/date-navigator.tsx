"use client"

import { format, isToday } from "date-fns"
import { es } from "date-fns/locale"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

interface DateNavigatorProps {
  date: Date
  onPrev: () => void
  onNext: () => void
  onToday: () => void
}

export function DateNavigator({ date, onPrev, onNext, onToday }: DateNavigatorProps) {
  const today = isToday(date)

  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="icon-sm" onClick={onPrev}>
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <button
        onClick={onToday}
        className="text-sm font-medium capitalize hover:underline"
      >
        {today ? "Hoy" : format(date, "EEE d MMM", { locale: es })}
      </button>

      <Button variant="ghost" size="icon-sm" onClick={onNext}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}
