import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import path from "path"

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    css: false,
    /**
     * Por encima del `asyncUtilTimeout: 5000` de `src/test/setup.ts`, y ese es
     * todo el motivo. El defecto de Vitest son 5000 ms tambien, o sea el MISMO
     * numero: una prueba que agote el presupuesto de su `findBy*` expira en el
     * mismo instante en que iba a rendirse, y lo hace como "Test timed out"
     * —un fallo del reloj de la prueba, no del codigo—. Con los dos valores
     * clavados uno contra otro, la suite completa se ponia roja de forma
     * intermitente bajo contencion (visto en `booking/public-client-step` y en
     * `(onboarding)/add-employee`, los dos verdes al ejecutarlos en solitario).
     * El limite de la prueba tiene que dejar sitio al de sus esperas.
     */
    testTimeout: 15000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
