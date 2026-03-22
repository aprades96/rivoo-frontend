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

export const staffApi = {
  // Employees
  listEmployees: (token: string) =>
    apiFetch<Page<Employee>>("/api/v1/staff/employees", { token }),

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
  listServices: (token: string) =>
    apiFetch<Page<ServiceOffering>>("/api/v1/services", { token }),

  createService: (data: CreateServiceRequest, token: string) =>
    apiFetch<ServiceOffering>("/api/v1/services", { method: "POST", body: data, token }),

  updateService: (id: string, data: UpdateServiceRequest, token: string) =>
    apiFetch<ServiceOffering>(`/api/v1/services/${id}`, { method: "PUT", body: data, token }),

  deleteService: (id: string, token: string) =>
    apiFetch<void>(`/api/v1/services/${id}`, { method: "DELETE", token }),
}
