import { generateTimeLabels, SLOT_HEIGHT_PX } from "@/lib/utils/calendar"

const labels = generateTimeLabels()

export function TimeGrid() {
  return (
    <div className="relative w-12 shrink-0 select-none">
      {labels.map((label, i) => (
        <div
          key={label}
          className="flex items-start border-t border-dashed border-muted"
          style={{ height: SLOT_HEIGHT_PX }}
        >
          {i % 2 === 0 && (
            <span className="-mt-2 text-[10px] text-muted-foreground">
              {label}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
