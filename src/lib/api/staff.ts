import { apiFetch } from "./client"
import type {
  Employee,
  CreateEmployeeRequest,
  UpdateEmployeeRequest,
  WorkingHoursRequest,
  WorkingHoursResponse,
  EmployeeServiceResponse,
  AssignServicesRequest,
} from "@/types/employee"
import type {
  ServiceOffering,
  CreateServiceRequest,
  UpdateServiceRequest,
} from "@/types/service"
import type { Page } from "@/types/api"

/** Omite las claves con valor `undefined`: evita mandar `includeInactive=`
 * o `size=` vacios cuando el llamante no los pide. */
function buildQuery(params: Record<string, string | undefined>): string {
  return Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
    .join("&")
}

export const staffApi = {
  // Employees
  //
  // `size=100` por defecto (D11): sin el, Spring devuelve 20 y una lista de
  // mas de 20 empleados se trunca en silencio. `includeInactive` es opcional
  // y por defecto `false` (D35), asi que el calendario, `/today` y el
  // asistente -- que llaman a `useEmployees()` sin argumentos -- siguen
  // viendo solo activos sin cambiar ni una linea.
  listEmployees: (token: string, opts?: { includeInactive?: boolean; size?: number }) =>
    apiFetch<Page<Employee>>(
      `/api/v1/staff/employees?${buildQuery({
        includeInactive: opts?.includeInactive ? "true" : undefined,
        size: String(opts?.size ?? 100),
      })}`,
      { token }
    ),

  getEmployee: (id: string, token: string) =>
    apiFetch<Employee>(`/api/v1/staff/employees/${id}`, { token }),

  createEmployee: (data: CreateEmployeeRequest, token: string) =>
    apiFetch<Employee>("/api/v1/staff/employees", { method: "POST", body: data, token }),

  updateEmployee: (id: string, data: UpdateEmployeeRequest, token: string) =>
    apiFetch<Employee>(`/api/v1/staff/employees/${id}`, { method: "PUT", body: data, token }),

  deleteEmployee: (id: string, token: string) =>
    apiFetch<void>(`/api/v1/staff/employees/${id}`, { method: "DELETE", token }),

  // Employee Working Hours
  getWorkingHours: (id: string, token: string) =>
    apiFetch<WorkingHoursResponse[]>(`/api/v1/staff/employees/${id}/working-hours`, { token }),

  updateWorkingHours: (id: string, data: WorkingHoursRequest[], token: string) =>
    apiFetch<WorkingHoursResponse[]>(`/api/v1/staff/employees/${id}/working-hours`, {
      method: "PUT",
      body: data,
      token,
    }),

  // Employee Services
  getEmployeeServices: (id: string, token: string) =>
    apiFetch<EmployeeServiceResponse[]>(`/api/v1/staff/employees/${id}/services`, { token }),

  assignServices: (id: string, data: AssignServicesRequest, token: string) =>
    apiFetch<EmployeeServiceResponse[]>(`/api/v1/staff/employees/${id}/services`, {
      method: "POST",
      body: data,
      token,
    }),

  // Service Catalog (route: /api/v1/services, NOT /api/v1/staff/services)
  // `size=100` por defecto, misma razon que `listEmployees` (D11).
  listServices: (token: string, opts?: { size?: number }) =>
    apiFetch<Page<ServiceOffering>>(
      `/api/v1/services?${buildQuery({ size: String(opts?.size ?? 100) })}`,
      { token }
    ),

  createService: (data: CreateServiceRequest, token: string) =>
    apiFetch<ServiceOffering>("/api/v1/services", { method: "POST", body: data, token }),

  updateService: (id: string, data: UpdateServiceRequest, token: string) =>
    apiFetch<ServiceOffering>(`/api/v1/services/${id}`, { method: "PUT", body: data, token }),

  deleteService: (id: string, token: string) =>
    apiFetch<void>(`/api/v1/services/${id}`, { method: "DELETE", token }),
}
