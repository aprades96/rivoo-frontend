const VALID_CURRENCY_CODE = /^[A-Za-z]{3}$/

export function formatCurrency(amount: number, currency: string = "EUR"): string {
  const safeCurrency = typeof currency === "string" && VALID_CURRENCY_CODE.test(currency) ? currency : "EUR"
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: safeCurrency,
  }).format(amount)
}

export function formatPhone(phone: string): string {
  // Spanish phone: +34 XXX XXX XXX
  const clean = phone.replace(/\D/g, "")
  if (clean.length === 9) {
    return `${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6)}`
  }
  if (clean.length === 11 && clean.startsWith("34")) {
    return `+34 ${clean.slice(2, 5)} ${clean.slice(5, 8)} ${clean.slice(8)}`
  }
  return phone
}

export function initials(firstName: string, lastName?: string): string {
  const first = firstName.charAt(0).toUpperCase()
  const last = lastName ? lastName.charAt(0).toUpperCase() : ""
  return `${first}${last}`
}

export function formatAddress(street: string, city: string, postalCode: string): string {
  return `${street}, ${city} ${postalCode}`
}

// Capitaliza solo la primera letra de la cadena. Distinto de la clase CSS
// `capitalize`, que mayusculiza la primera letra de CADA palabra -- en una
// fecha tipo "martes, 27 de agosto" eso tambien mayusculiza "de" y el mes
// ("Martes, 27 De Agosto"), que no es lo que dibujan los artboards
// ("Martes, 27 de agosto"). Usar siempre este helper para textos de fecha en
// castellano ya formateados por date-fns (que devuelve dia/mes en minuscula).
export function capitalizeFirst(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
