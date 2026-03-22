"use client"

import { create } from "zustand"

interface AppState {
  selectedDate: Date
  setSelectedDate: (date: Date) => void
  calendarView: "day" | "week"
  setCalendarView: (view: "day" | "week") => void
}

export const useAppStore = create<AppState>((set) => ({
  selectedDate: new Date(),
  setSelectedDate: (date) => set({ selectedDate: date }),
  calendarView: "day",
  setCalendarView: (view) => set({ calendarView: view }),
}))
