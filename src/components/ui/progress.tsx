"use client"

import { Progress as ProgressPrimitive } from "@base-ui/react/progress"

import { cn } from "@/lib/utils"

// Sin esto, `aria-valuetext` sale de `Intl.NumberFormat` con la configuracion
// regional del entorno (`node_modules/@base-ui/react/progress/root/ProgressRoot.js`,
// `formatNumberValue`), que en el servidor (Node) y en el navegador no tiene
// por que coincidir: server "100%", cliente "100 %" (espacio fino), y React
// lo marca como error de hidratacion en todas las pantallas del asistente.
// `getAriaValueText` evita el paso por Intl del todo, asi el texto sale
// identico en los dos renders. Verificado leyendo
// `node_modules/@base-ui/react/progress/root/ProgressRoot.d.ts`: `format` solo
// cambia las opciones que recibe Intl (mismo problema de fondo), `locale` fija
// el locale pero sigue dependiendo de que el ICU del servidor y el del
// navegador formateen igual; `getAriaValueText` es el unico de los tres que no
// depende de Intl.
function getAriaValueText(_formattedValue: string | null, value: number | null) {
  return value == null ? "progreso indeterminado" : `${Math.round(value)}%`
}

function Progress({ className, ...props }: ProgressPrimitive.Root.Props) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn("w-full", className)}
      getAriaValueText={getAriaValueText}
      {...props}
    >
      <ProgressPrimitive.Track
        data-slot="progress-track"
        className="h-1.5 w-full overflow-hidden rounded-full bg-hairline"
      >
        <ProgressPrimitive.Indicator
          data-slot="progress-indicator"
          className="h-full rounded-full bg-primary transition-[width] duration-[var(--motion-fast)] ease-out"
        />
      </ProgressPrimitive.Track>
    </ProgressPrimitive.Root>
  )
}

export { Progress }
