import "@testing-library/jest-dom/vitest"
import { configure } from "@testing-library/react"

/**
 * `findBy*` se rinde a los 1000 ms por defecto. Con los 40 ficheros de la suite
 * corriendo en paralelo, el primer render de un componente con consulta de React
 * Query se pasa de ese limite en esta maquina (medido: 1,5 s) aunque el mismo
 * fichero tarde 300 ms ejecutado solo. Eso pone roja la suite entera de forma
 * intermitente por el reloj de la prueba, no por el codigo: el dato del mock se
 * resuelve en un microtask, lo que tarda es montar jsdom bajo contencion.
 */
configure({ asyncUtilTimeout: 5000 })

/**
 * jsdom no implementa `window.matchMedia` (lanza "not implemented"). Lo
 * necesita `useMediaQuery` (`src/hooks/use-media-query.ts`), que consumen
 * `BookingStepShell` y cualquier prueba que lo renderice, directamente o a
 * traves de `book/[slug]/page.tsx`. Por defecto no coincide con ninguna query
 * (`matches: false`), igual que el snapshot de servidor del hook -- las
 * pruebas que necesiten simular escritorio sobrescriben `window.matchMedia`
 * ellas mismas.
 */
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList
}
