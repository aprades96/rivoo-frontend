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
