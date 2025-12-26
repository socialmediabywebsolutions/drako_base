import { resolveEmployeesContext } from "@/lib/employees/context";
import { checkEmployeeCompliance } from "@/lib/employees/compliance";
import {
  getEmployeeById,
  getEmployeeContract,
  getEmployeeHrFlags,
  getEmployeeWorkloadSnapshot,
  listEmployeeRoles,
} from "@/lib/employees/repository";
import type {
  EmployeeComplianceReport,
  EmployeeContract,
  EmployeeHRFlags,
  EmployeeRole,
  EmployeeWorkloadSnapshot,
  EmployeeWithContext,
} from "@/lib/employees/types";
import { getPricingSuggestions } from "@/lib/economy/pricing";
import {
  getLowStockItems,
  getServiceInventoryStatus,
  getServicePhases,
  listSaasInventoryItems,
  listSaasServiceProducts,
  listSaasServices,
  resolveEconomyContext,
} from "@/lib/economy/repository";
import type { SaasInventoryItem, SaasService, SaasServiceProduct, ServicePhase } from "@/lib/economy/types";
import type { PricingSuggestion } from "@/lib/economy/pricing";
import { listAppointmentsForEmployee, resolveAppointmentsContext } from "@/lib/appointments/repository";
import type { AppointmentStatus, SaasAppointment } from "@/lib/appointments/types";
import {
  getSaasCustomerMetrics,
  listSaasCustomerBookings,
  listSaasCustomers,
  resolveCustomersContext,
} from "@/lib/customers/repository";
import type { SaasCustomer, SaasCustomerBooking, SaasCustomerMetrics } from "@/lib/customers/types";

export type PartnerFairnessStatus = "OK" | "WARNING" | "CRITICAL";

export type PartnerServiceUsage = {
  serviceId: string;
  serviceName: string;
  marginCurrent?: number;
  status?: PricingSuggestion["status"];
};

export type PartnerInventoryUsage = {
  serviceId: string;
  serviceName: string;
  items: Array<{
    inventoryItemId: string;
    name: string;
    quantityPerService: number;
    stockQuantity: number;
    minStockQuantity: number;
    status: "OK" | "LOW_STOCK";
  }>;
};

export type PartnerInventoryWarning = {
  serviceId: string;
  serviceName: string;
  items: Array<{
    inventoryItemId: string;
    name: string;
    quantityPerService: number;
    stockQuantity: number;
    minStockQuantity: number;
    isLowStock: boolean;
  }>;
};

export type PartnerAppointment = SaasAppointment & {
  serviceName?: string;
  serviceDurationMinutes?: number;
};

export type PartnerServiceInventoryItem = {
  inventoryItemId: string;
  name: string;
  quantityPerService: number;
  stockQuantity: number;
  minStockQuantity: number;
  costPerUnit: number;
};

export type PartnerServiceInventory = {
  serviceId: string;
  serviceName: string;
  items: PartnerServiceInventoryItem[];
};

export type PartnerServiceInventoryIssue = {
  serviceId: string;
  serviceName: string;
  status: "OK" | "LOW_STOCK" | "OUT_OF_STOCK";
  items: PartnerServiceInventoryItem[];
};

export type EmployeeTodayScheduleSummary = {
  totalAppointments: number;
  totalsByStatus: Record<AppointmentStatus, number>;
  totalMinutesPlanned: number;
  windowStart: string | null;
  windowEnd: string | null;
};

export type PartnerEconomyStats = {
  averageServiceMargin?: number;
  topProfitableServices: Array<{ serviceId: string; name: string; margin: number }>;
  lowMarginServices: Array<{ serviceId: string; name: string; margin: number }>;
};

export type PartnerCustomerBooking = SaasCustomerBooking & {
  customerName: string;
  customerIsVip: boolean;
  serviceName?: string;
  serviceDurationMinutes?: number;
};

export type EmployeePartnerContext = {
  tenantId: string;
  saasId: string;
  employee: EmployeeWithContext;
  role: EmployeeRole | null;
  contract: EmployeeContract | null;
  hrFlags: EmployeeHRFlags | null;
  hrComplianceReport: EmployeeComplianceReport;
  workloadSnapshot: EmployeeWorkloadSnapshot;
  services: PartnerServiceUsage[];
  inventoryUsage: PartnerInventoryUsage[];
  inventoryWarnings: PartnerInventoryWarning[];
  economyStats: PartnerEconomyStats;
  bookings: PartnerCustomerBooking[];
  todayBookings: PartnerCustomerBooking[];
  customerMetrics: Record<string, SaasCustomerMetrics>;
  servicePhases: Record<string, ServicePhase[]>;
  appointmentsToday: PartnerAppointment[];
  servicesForAppointments: Record<string, SaasService>;
  inventoryForServices: PartnerServiceInventory[];
  todayScheduleSummary: EmployeeTodayScheduleSummary;
  serviceInventoryIssues: PartnerServiceInventoryIssue[];
  realtimeSuggestions: PartnerSuggestion[];
  fairnessStatus: PartnerFairnessStatus;
};

export type PartnerSuggestion = {
  title: string;
  detail: string;
  severity: "info" | "warn" | "critical";
};

function resolveFairnessStatus(report: EmployeeComplianceReport): PartnerFairnessStatus {
  if (report.status === "CRITICAL") return "CRITICAL";
  if (report.status === "WARNING") return "WARNING";
  return "OK";
}

function startOfToday(): Date {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start;
}

function endOfToday(): Date {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return end;
}

function pickTodayBookings(bookings: PartnerCustomerBooking[]): PartnerCustomerBooking[] {
  const start = startOfToday();
  const end = endOfToday();
  return bookings
    .filter((booking) => {
      const ts = new Date(booking.startTime);
      return ts >= start && ts <= end;
    })
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
}

function deriveInventoryUsage(
  services: PartnerServiceUsage[],
  productsByService: Map<string, SaasServiceProduct[]>,
  inventoryItems: SaasInventoryItem[],
): PartnerInventoryUsage[] {
  const inventoryMap = new Map(inventoryItems.map((item) => [item.id, item]));
  return services.map((service) => {
    const products = productsByService.get(service.serviceId) ?? [];
    const items = products.map((product) => {
      const item = inventoryMap.get(product.inventoryItemId);
      const stockQuantity = item?.stockQuantity ?? 0;
      const minStockQuantity = item?.minStockQuantity ?? 0;
      const status: PartnerInventoryUsage["items"][number]["status"] = stockQuantity < minStockQuantity ? "LOW_STOCK" : "OK";
      return {
        inventoryItemId: product.inventoryItemId,
        name: item?.name ?? product.inventoryItemId,
        quantityPerService: product.quantityPerService,
        stockQuantity,
        minStockQuantity,
        status,
      };
    });
    return {
      serviceId: service.serviceId,
      serviceName: service.serviceName,
      items,
    };
  });
}

function buildServiceInventory(
  serviceIds: string[],
  serviceMap: Map<string, SaasService>,
  productsByService: Map<string, SaasServiceProduct[]>,
  inventoryItems: SaasInventoryItem[],
): PartnerServiceInventory[] {
  const inventoryMap = new Map(inventoryItems.map((item) => [item.id, item]));
  return serviceIds.map((serviceId) => {
    const service = serviceMap.get(serviceId);
    const products = productsByService.get(serviceId) ?? [];
    const items = products.map((product) => {
      const item = inventoryMap.get(product.inventoryItemId);
      return {
        inventoryItemId: product.inventoryItemId,
        name: item?.name ?? product.inventoryItemId,
        quantityPerService: product.quantityPerService,
        stockQuantity: item?.stockQuantity ?? 0,
        minStockQuantity: item?.minStockQuantity ?? 0,
        costPerUnit: item?.costPerUnit ?? 0,
      };
    });
    return {
      serviceId,
      serviceName: service?.name ?? "Servicio",
      items,
    };
  });
}

async function buildEconomySnapshot(
  tenantId: string,
  saasId: string,
  serviceIds: string[],
  env: Parameters<typeof resolveEconomyContext>[0]["env"],
): Promise<{
  services: PartnerServiceUsage[];
  inventoryUsage: PartnerInventoryUsage[];
  economyStats: PartnerEconomyStats;
}> {
  try {
    const economyCtx = await resolveEconomyContext({ tenantId, saasId, env });
    const [services, suggestions, inventoryItems] = await Promise.all([
      listSaasServices(economyCtx),
      getPricingSuggestions(economyCtx),
      listSaasInventoryItems(economyCtx),
    ]);

    const relevantSuggestions = suggestions.filter((suggestion) => serviceIds.includes(suggestion.serviceId));

    const servicesUsage: PartnerServiceUsage[] =
      relevantSuggestions.length > 0
        ? relevantSuggestions.map((suggestion) => ({
            serviceId: suggestion.serviceId,
            serviceName: suggestion.serviceName,
            marginCurrent: suggestion.marginCurrent,
            status: suggestion.status,
          }))
        : services
            .filter((service) => serviceIds.includes(service.id))
            .map((service) => ({
              serviceId: service.id,
              serviceName: service.name,
            }));

    const productsByService = new Map<string, SaasServiceProduct[]>();
    await Promise.all(
      serviceIds.map(async (serviceId) => {
        const products = await listSaasServiceProducts(economyCtx, serviceId);
        productsByService.set(serviceId, products);
      }),
    );

    const inventoryUsage = deriveInventoryUsage(servicesUsage, productsByService, inventoryItems);

    const averageServiceMargin = servicesUsage.length
      ? servicesUsage.reduce((acc, item) => acc + (item.marginCurrent ?? 0), 0) / servicesUsage.length
      : undefined;

    const topProfitableServices = [...servicesUsage]
      .filter((item) => typeof item.marginCurrent === "number")
      .sort((a, b) => (b.marginCurrent ?? 0) - (a.marginCurrent ?? 0))
      .slice(0, 3)
      .map((item) => ({ serviceId: item.serviceId, name: item.serviceName, margin: item.marginCurrent ?? 0 }));

    const lowMarginServices = servicesUsage
      .filter((item) => item.status && item.status !== "OK")
      .map((item) => ({ serviceId: item.serviceId, name: item.serviceName, margin: item.marginCurrent ?? 0 }));

    return {
      services: servicesUsage,
      inventoryUsage,
      economyStats: {
        averageServiceMargin,
        topProfitableServices,
        lowMarginServices,
      },
    };
  } catch (error) {
    console.warn("EMPLOYEE_PARTNER_ECONOMY_FALLBACK", error);
    return {
      services: [],
      inventoryUsage: [],
      economyStats: { averageServiceMargin: undefined, topProfitableServices: [], lowMarginServices: [] },
    };
  }
}

function buildBooking(
  booking: SaasCustomerBooking,
  customer: SaasCustomer,
  serviceName?: string,
  serviceDurationMinutes?: number,
): PartnerCustomerBooking {
  return {
    ...booking,
    customerName: customer.fullName,
    customerIsVip: customer.isVip,
    serviceName,
    serviceDurationMinutes,
  };
}

function buildScheduleSummary(appointments: PartnerAppointment[]): EmployeeTodayScheduleSummary {
  const statuses: AppointmentStatus[] = ["REQUESTED", "PENDING", "CONFIRMED", "IN_PROGRESS", "DONE", "NO_SHOW", "CANCELLED"];
  const totalsByStatus = Object.fromEntries(statuses.map((status) => [status, 0])) as Record<AppointmentStatus, number>;
  let totalMinutes = 0;
  let windowStart: number | null = null;
  let windowEnd: number | null = null;

  appointments.forEach((appointment) => {
    totalsByStatus[appointment.status] = (totalsByStatus[appointment.status] ?? 0) + 1;
    const start = new Date(appointment.scheduledStart);
    const end = new Date(appointment.scheduledEnd);
    const startMs = start.getTime();
    const endMs = end.getTime();
    if (!Number.isNaN(startMs) && !Number.isNaN(endMs) && endMs >= startMs) {
      totalMinutes += Math.max(0, (endMs - startMs) / (1000 * 60));
      windowStart = windowStart === null ? startMs : Math.min(windowStart, startMs);
      windowEnd = windowEnd === null ? endMs : Math.max(windowEnd, endMs);
    } else if (appointment.serviceDurationMinutes) {
      totalMinutes += appointment.serviceDurationMinutes;
    }
  });

  return {
    totalAppointments: appointments.length,
    totalsByStatus,
    totalMinutesPlanned: Math.round(totalMinutes),
    windowStart: windowStart ? new Date(windowStart).toISOString() : null,
    windowEnd: windowEnd ? new Date(windowEnd).toISOString() : null,
  };
}

function deriveServiceInventoryIssues(inventoryForServices: PartnerServiceInventory[]): PartnerServiceInventoryIssue[] {
  return inventoryForServices.map((service) => {
    let status: PartnerServiceInventoryIssue["status"] = "OK";
    service.items.forEach((item) => {
      if (item.stockQuantity < item.quantityPerService) {
        status = "OUT_OF_STOCK";
      } else if (status !== "OUT_OF_STOCK" && (item.stockQuantity < item.minStockQuantity || item.stockQuantity < item.quantityPerService * 2)) {
        status = "LOW_STOCK";
      }
    });
    return {
      serviceId: service.serviceId,
      serviceName: service.serviceName,
      status,
      items: service.items,
    };
  });
}

export async function buildEmployeePartnerContext(params: {
  tenantId: string;
  saasId: string;
  employeeId: string;
  env?: Parameters<typeof resolveEconomyContext>[0]["env"];
}): Promise<EmployeePartnerContext> {
  const { tenantId, saasId, employeeId, env } = params;
  const employeesContext = await resolveEmployeesContext(tenantId, saasId);
  const customersContext = await resolveCustomersContext({ tenantId, saasId, env });
  const employee = await getEmployeeById(employeesContext, employeeId);
  if (!employee) {
    throw new Error("Employee not found for partner context");
  }

  const [roles, contract, hrFlags, workloadSnapshot, hrComplianceReport, customers] = await Promise.all([
    listEmployeeRoles(employeesContext, saasId),
    getEmployeeContract(employeesContext, employeeId),
    getEmployeeHrFlags(employeesContext, employeeId),
    getEmployeeWorkloadSnapshot(employeesContext, employeeId, "week"),
    checkEmployeeCompliance(employeesContext, employeeId),
    listSaasCustomers(customersContext),
  ]);

  const customerBookings = await Promise.all(
    customers.map(async (customer) => ({
      customer,
      bookings: await listSaasCustomerBookings(customersContext, customer.id),
    })),
  );

  const bookingsForEmployee: PartnerCustomerBooking[] = [];
  const serviceIds = new Set<string>();
  for (const item of customerBookings) {
    item.bookings
      .filter((booking) => !booking.employeeId || booking.employeeId === employeeId)
      .forEach((booking) => {
        serviceIds.add(booking.serviceId);
        bookingsForEmployee.push(buildBooking(booking, item.customer));
      });
  }

  let economyCtxForNames: Awaited<ReturnType<typeof resolveEconomyContext>> | null = null;
  try {
    economyCtxForNames = await resolveEconomyContext({ tenantId, saasId, env });
  } catch {
    economyCtxForNames = null;
  }

  const servicesList = economyCtxForNames ? await listSaasServices(economyCtxForNames).catch(() => []) : [];
  const serviceMap = new Map(servicesList.map((service) => [service.id, service]));
  bookingsForEmployee.forEach((booking, index) => {
    const service = serviceMap.get(booking.serviceId);
    if (service) {
      bookingsForEmployee[index] = buildBooking(booking, customers.find((c) => c.id === booking.customerId)!, service.name, service.durationMinutes);
    }
  });

  const economy = await buildEconomySnapshot(tenantId, saasId, Array.from(serviceIds), env);
  const fairnessStatus = resolveFairnessStatus(hrComplianceReport);
  const role = roles.find((r) => r.slug === employee.role) ?? null;
  const todayBookings = pickTodayBookings(bookingsForEmployee);

  const appointmentsCtx = await resolveAppointmentsContext({ tenantId, saasId, env }).catch(() => null);
  const appointmentsTodayRaw = appointmentsCtx
    ? await listAppointmentsForEmployee(appointmentsCtx, employeeId, {
        from: startOfToday().toISOString(),
        to: endOfToday().toISOString(),
      }).catch(() => [])
    : [];
  const appointmentsToday: PartnerAppointment[] = appointmentsTodayRaw.map((appointment) => {
    const service = serviceMap.get(appointment.serviceId);
    return {
      ...appointment,
      serviceName: service?.name,
      serviceDurationMinutes: service?.durationMinutes,
    };
  });

  const appointmentServiceIds = Array.from(new Set(appointmentsToday.map((appointment) => appointment.serviceId)));
  const servicesForAppointments = Object.fromEntries(
    appointmentServiceIds
      .map((serviceId) => {
        const service = serviceMap.get(serviceId);
        return service ? [serviceId, service] : null;
      })
      .filter((entry): entry is [string, SaasService] => Boolean(entry)),
  );

  let inventoryForServices: PartnerServiceInventory[] = [];
  if (economyCtxForNames && appointmentServiceIds.length > 0) {
    const inventoryItems = await listSaasInventoryItems(economyCtxForNames).catch(() => []);
    const productsByService = new Map<string, SaasServiceProduct[]>();
    await Promise.all(
      appointmentServiceIds.map(async (serviceId) => {
        const products = await listSaasServiceProducts(economyCtxForNames!, serviceId).catch(() => []);
        productsByService.set(serviceId, products);
      }),
    );
    inventoryForServices = buildServiceInventory(appointmentServiceIds, serviceMap, productsByService, inventoryItems);
  }

  const todayScheduleSummary = buildScheduleSummary(appointmentsToday);
  const serviceInventoryIssues = deriveServiceInventoryIssues(inventoryForServices);
  let realtimeSuggestions: PartnerSuggestion[] = [];

  let inventoryWarnings: PartnerInventoryWarning[] = [];
  let servicePhases: Record<string, ServicePhase[]> = {};
  if (economyCtxForNames) {
    const lowStockItems = await getLowStockItems(economyCtxForNames);
    const lowStockIds = new Set(lowStockItems.map((item) => item.id));
    const serviceIdsList = Array.from(new Set(bookingsForEmployee.map((booking) => booking.serviceId)));
    const statuses = await Promise.all(serviceIdsList.map((serviceId) => getServiceInventoryStatus(economyCtxForNames!, serviceId)));
    inventoryWarnings = statuses
      .map((status) => {
        const service = serviceMap.get(status.serviceId);
        const items = status.items
          .map((item) => ({
            ...item,
            isLowStock: item.isLowStock || lowStockIds.has(item.inventoryItemId),
          }))
          .filter((item) => item.isLowStock);
        if (items.length === 0) return null;
        return {
          serviceId: status.serviceId,
          serviceName: service?.name ?? "Servicio",
          items,
        };
      })
      .filter((item): item is PartnerInventoryWarning => Boolean(item));

    const todayServiceIds = Array.from(new Set(todayBookings.map((booking) => booking.serviceId)));
    servicePhases = Object.fromEntries(
      todayServiceIds
        .map((serviceId) => {
          const service = serviceMap.get(serviceId);
          const phases = service ? getServicePhases(service) : [];
          return [serviceId, phases] as const;
        })
        .filter(([, phases]) => phases.length > 0),
    );
  }

  const metricsEntries = await Promise.all(
    Array.from(new Set(bookingsForEmployee.map((b) => b.customerId))).map(async (customerId) => {
      const metrics = await getSaasCustomerMetrics(customersContext, customerId);
      return [customerId, metrics] as const;
    }),
  );
  const customerMetrics = Object.fromEntries(metricsEntries);
  realtimeSuggestions = getEmployeeRealtimeSuggestions({
    tenantId,
    saasId,
    employee,
    role,
    contract,
    hrFlags,
    hrComplianceReport,
    workloadSnapshot,
    services: economy.services,
    inventoryUsage: economy.inventoryUsage,
    inventoryWarnings,
    economyStats: economy.economyStats,
    bookings: bookingsForEmployee,
    todayBookings,
    customerMetrics,
    servicePhases,
    appointmentsToday,
    servicesForAppointments,
    inventoryForServices,
    todayScheduleSummary,
    serviceInventoryIssues,
    realtimeSuggestions: [],
    fairnessStatus,
  });

  return {
    tenantId,
    saasId,
    employee,
    role,
    contract,
    hrFlags,
    hrComplianceReport,
    workloadSnapshot,
    services: economy.services,
    inventoryUsage: economy.inventoryUsage,
    inventoryWarnings,
    economyStats: economy.economyStats,
    bookings: bookingsForEmployee,
    todayBookings,
    customerMetrics,
    servicePhases,
    appointmentsToday,
    servicesForAppointments,
    inventoryForServices,
    todayScheduleSummary,
    serviceInventoryIssues,
    realtimeSuggestions,
    fairnessStatus,
  };
}

export function getEmployeeTodayScheduleSummary(ctx: EmployeePartnerContext): EmployeeTodayScheduleSummary {
  return buildScheduleSummary(ctx.appointmentsToday);
}

export function getEmployeeServiceInventoryIssues(ctx: EmployeePartnerContext): PartnerServiceInventoryIssue[] {
  return deriveServiceInventoryIssues(ctx.inventoryForServices);
}

export function getEmployeeRealtimeSuggestions(ctx: EmployeePartnerContext): PartnerSuggestion[] {
  const suggestions: PartnerSuggestion[] = [];
  const inventoryIssues = ctx.serviceInventoryIssues.filter((issue) => issue.status !== "OK");
  if (inventoryIssues.length > 0) {
    const issue = inventoryIssues[0];
    suggestions.push({
      title: `Stock ${issue.status === "OUT_OF_STOCK" ? "agotado" : "bajo"} para ${issue.serviceName}`,
      detail:
        issue.status === "OUT_OF_STOCK"
          ? "Hay productos sin stock para servicios de hoy. Coordina cambios o reposición urgente."
          : "Revisa el inventario antes de empezar; hay productos cerca del mínimo.",
      severity: issue.status === "OUT_OF_STOCK" ? "critical" : "warn",
    });
  }

  if (ctx.todayScheduleSummary.totalAppointments === 0) {
    suggestions.push({
      title: "Agenda despejada",
      detail: "No tienes citas hoy. Es un buen momento para preparar materiales o captar clientes.",
      severity: "info",
    });
  }

  const appointments = [...ctx.appointmentsToday].sort(
    (a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime(),
  );
  for (let i = 0; i < appointments.length - 1; i += 1) {
    const current = appointments[i];
    const next = appointments[i + 1];
    const currentEnd = new Date(current.scheduledEnd).getTime();
    const nextStart = new Date(next.scheduledStart).getTime();
    if (!Number.isNaN(currentEnd) && !Number.isNaN(nextStart)) {
      const gapMinutes = (nextStart - currentEnd) / (1000 * 60);
      if (gapMinutes >= 45) {
        suggestions.push({
          title: "Hueco detectado en la agenda",
          detail: `Tienes un hueco de ~${Math.round(gapMinutes)} minutos entre citas. Es buen momento para un servicio corto o seguimiento.`,
          severity: "info",
        });
        break;
      }
    }
  }

  const maxHours = ctx.contract?.maxHoursWeek ?? ctx.hrComplianceReport.metrics.maxHoursWeek;
  if (maxHours && ctx.workloadSnapshot.actualHours >= maxHours * 0.95) {
    suggestions.push({
      title: "Al límite de horas semanales",
      detail: "Estás muy cerca del máximo semanal. Evita añadir citas extra sin ajustar contrato.",
      severity: "warn",
    });
  }

  const colorAppointments = ctx.appointmentsToday.filter((appointment) => appointment.serviceName?.toLowerCase().includes("color"));
  if (colorAppointments.length >= 2) {
    suggestions.push({
      title: "Día cargado de color",
      detail: "Tienes varias citas de color hoy. Revisa oxidantes y prepara la zona antes de empezar.",
      severity: "info",
    });
  }

  return suggestions;
}

export function getEmployeeDayPlan(ctx: EmployeePartnerContext): string[] {
  if (ctx.todayBookings.length === 0) return ["Sin citas hoy. Mantén tiempo para formación, marketing o revisar inventario."];
  return ctx.todayBookings.map((booking) => {
    const start = new Date(booking.startTime);
    const hh = start.getHours().toString().padStart(2, "0");
    const mm = start.getMinutes().toString().padStart(2, "0");
    const duration = booking.serviceDurationMinutes ?? 60;
    const vipNote = booking.customerIsVip ? "Cliente VIP. " : "";
    const serviceName = booking.serviceName ?? "Servicio";
    const stockHint = ctx.inventoryUsage
      .find((usage) => usage.serviceId === booking.serviceId)
      ?.items.find((item) => item.status === "LOW_STOCK");
    const stockNote = stockHint ? `Revisa stock de ${stockHint.name} antes de empezar.` : "Revisa kit y tiempos de preparación.";
    return `${hh}:${mm} — ${serviceName} a ${booking.customerName}, ${duration} minutos. ${vipNote}${stockNote}`;
  });
}

export function getEmployeeInventorySuggestions(ctx: EmployeePartnerContext): PartnerSuggestion[] {
  const suggestions: PartnerSuggestion[] = [];
  const seen = new Set<string>();
  const todayServiceIds = new Set(ctx.todayBookings.map((booking) => booking.serviceId));
  ctx.inventoryWarnings
    .filter((warning) => todayServiceIds.has(warning.serviceId))
    .forEach((warning) => {
      warning.items
        .filter((item) => item.isLowStock)
        .forEach((item) => {
          const key = `${warning.serviceId}:${item.inventoryItemId}`;
          if (seen.has(key)) return;
          seen.add(key);
          const remainingServices = item.quantityPerService > 0 ? Math.floor(item.stockQuantity / item.quantityPerService) : 0;
          suggestions.push({
            title: `Stock bajo: ${item.name}`,
            detail: `Tienes reservas de ${warning.serviceName} y queda poco ${item.name}. Quedan ~${remainingServices} usos antes de agotarse.`,
            severity: "warn",
          });
        });
    });
  ctx.inventoryUsage.forEach((usage) => {
    usage.items
      .filter((item) => item.status === "LOW_STOCK")
      .forEach((item) => {
        const key = `${usage.serviceId}:${item.inventoryItemId}`;
        if (seen.has(key)) return;
        seen.add(key);
        const remainingServices = item.quantityPerService > 0 ? Math.floor(item.stockQuantity / item.quantityPerService) : 0;
        suggestions.push({
          title: `Stock bajo: ${item.name}`,
          detail: `El servicio ${usage.serviceName} quedaría sin ${item.name} en ~${remainingServices} usos. Programa compra o ajusta citas.`,
          severity: "warn",
        });
      });
  });
  return suggestions;
}

export function getEmployeeHrSuggestions(ctx: EmployeePartnerContext): PartnerSuggestion[] {
  const suggestions: PartnerSuggestion[] = [];
  const status = ctx.hrComplianceReport.status;
  if (status === "CRITICAL") {
    suggestions.push({
      title: "Fairness crítico",
      detail: "Antes de cargar más horas o citas, revisa contrato, salario y Fairness Guard.",
      severity: "critical",
    });
  } else if (status === "WARNING") {
    suggestions.push({
      title: "Fairness en observación",
      detail: "Ajusta turnos o revisa el contrato para evitar sobrecarga o sueldo por debajo del mínimo.",
      severity: "warn",
    });
  }

  const maxHours = ctx.contract?.maxHoursWeek ?? ctx.hrComplianceReport.metrics.maxHoursWeek ?? ctx.workloadSnapshot.plannedHours;
  if (maxHours && ctx.workloadSnapshot.actualHours >= maxHours * 0.9) {
    suggestions.push({
      title: "Cerca del máximo semanal",
      detail: "Planifica descansos y evita asignar nuevas citas de última hora.",
      severity: "warn",
    });
  }

  if (ctx.workloadSnapshot.plannedHours < (ctx.contract?.minHoursWeek ?? 20) * 0.6) {
    suggestions.push({
      title: "Infrautilización detectada",
      detail: "Redistribuye reservas hacia este perfil para equilibrar carga y experiencia.",
      severity: "info",
    });
  }

  if (ctx.hrFlags?.isOverworkedSuspected) {
    suggestions.push({
      title: "Posible sobrecarga",
      detail: "Hay señales de sobrecarga. Revisa descansos y limita nuevas citas en horas pico.",
      severity: "warn",
    });
  }
  if (ctx.hrFlags?.isUnderpaidSuspected) {
    suggestions.push({
      title: "Revisar salario",
      detail: "El sueldo/hora podría estar por debajo del mínimo configurado. Contrasta con HR Settings.",
      severity: "warn",
    });
  }

  return suggestions;
}

export function getEmployeeEconomySuggestions(ctx: EmployeePartnerContext): PartnerSuggestion[] {
  const suggestions: PartnerSuggestion[] = [];
  const lowStockItems = ctx.inventoryUsage.flatMap((usage) =>
    usage.items.filter((item) => item.status === "LOW_STOCK").map((item) => ({ ...item, serviceName: usage.serviceName })),
  );
  if (lowStockItems.length > 0) {
    const first = lowStockItems[0];
    suggestions.push({
      title: "Productos cerca del mínimo",
      detail: `${first.name} se usa en ${first.serviceName} y está por debajo del mínimo. Programa compra para evitar roturas de stock.`,
      severity: "warn",
    });
  }

  if (ctx.economyStats.averageServiceMargin !== undefined && ctx.economyStats.averageServiceMargin < 25) {
    suggestions.push({
      title: "Margen ajustado",
      detail: "El margen medio de servicios de este empleado es bajo. Considera aplicar precios sugeridos o priorizar servicios más rentables.",
      severity: "warn",
    });
  }

  return suggestions;
}

export function getEmployeeCustomerCareSuggestions(ctx: EmployeePartnerContext): PartnerSuggestion[] {
  const suggestions: PartnerSuggestion[] = [];
  ctx.bookings.forEach((booking) => {
    const metrics = ctx.customerMetrics[booking.customerId];
    if (metrics?.lastVisitAt) {
      const lastVisit = new Date(metrics.lastVisitAt);
      const monthsAgo = (Date.now() - lastVisit.getTime()) / (1000 * 60 * 60 * 24 * 30);
      if (monthsAgo >= 6) {
        suggestions.push({
          title: `Reactivar a ${booking.customerName}`,
          detail: `No visita desde hace ${monthsAgo.toFixed(0)} meses. Propón un tratamiento de retorno con incentivo suave.`,
          severity: "info",
        });
      }
    }
    if (booking.customerIsVip) {
      suggestions.push({
        title: "Cuidado VIP",
        detail: `${booking.customerName} es VIP. Recuerda proponer siguiente cita y un extra rápido (mascarilla express, masaje corto).`,
        severity: "info",
      });
    }
  });
  return suggestions.slice(0, 4);
}

export function getEmployeeOperationalSuggestions(ctx: EmployeePartnerContext): PartnerSuggestion[] {
  const suggestions: PartnerSuggestion[] = [];
  const freeHours = Math.max(0, (ctx.workloadSnapshot.plannedHours ?? 0) - (ctx.workloadSnapshot.actualHours ?? 0));

  if (ctx.todayBookings.length === 0) {
    suggestions.push({
      title: "Agenda libre hoy",
      detail: "Sin citas asignadas. Coordina con recepción para mover citas o lanzar una promo rápida.",
      severity: "info",
    });
  } else if (freeHours >= 2) {
    suggestions.push({
      title: "Huecos libres detectados",
      detail: `Quedan ~${freeHours.toFixed(1)}h libres esta semana. Intenta rellenarlas con citas de alto valor o seguimiento de clientes recientes.`,
      severity: "info",
    });
  }

  const lowMargin = ctx.economyStats.lowMarginServices[0];
  if (lowMargin) {
    suggestions.push({
      title: "Servicios de margen bajo",
      detail: `${ctx.employee.fullName} está cubriendo servicios con margen bajo como ${lowMargin.name}. Considera upselling o ajustar precios cuando sea posible.`,
      severity: "warn",
    });
  }

  return suggestions;
}

export function getEmployeePhaseSuggestions(ctx: EmployeePartnerContext): PartnerSuggestion[] {
  const suggestions: PartnerSuggestion[] = [];
  ctx.todayBookings.forEach((booking) => {
    const phases = ctx.servicePhases[booking.serviceId];
    if (!phases || phases.length === 0) return;
    const processPhase = phases.find((phase) => phase.phaseType === "PROCESS") ?? phases[0];
    suggestions.push({
      title: `Recuerda iniciar ${processPhase.label}`,
      detail: `Temporizador para ${processPhase.phaseType} en ${booking.customerName} (${processPhase.durationMinutes} min).`,
      severity: "info",
    });
  });
  return suggestions.slice(0, 4);
}

// TODO: Enchufar modelos IA para enriquecer sugerencias de estilo/atención con visión y conversación.
export function getEmployeeStyleSuggestions(
  ctx: EmployeePartnerContext,
  clientProfile?: { eventType?: string; hairLength?: string; preferences?: string[] },
): PartnerSuggestion[] {
  const baseService = ctx.services[0];
  const refServiceName = baseService?.serviceName ?? "servicio estrella";
  const preference = clientProfile?.preferences?.[0];
  const detailParts = [
    `Recomienda ${refServiceName} como propuesta base`,
    preference ? `Incluye preferencia del cliente: ${preference}` : null,
    clientProfile?.eventType ? `Evento: ${clientProfile.eventType}` : null,
  ].filter(Boolean);

  return [
    {
      title: "Inspiración de estilo",
      detail:
        detailParts.join(". ") ||
        "Propón un look alineado con los servicios actuales y prepara nota para IA/visión en siguientes iteraciones.",
      severity: "info",
    },
  ];
}
