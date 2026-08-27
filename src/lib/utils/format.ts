export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
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
