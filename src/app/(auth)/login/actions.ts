"use server"

import { signIn } from "@/auth"

export async function loginAction() {
  await signIn("keycloak", { redirectTo: "/today" })
}
