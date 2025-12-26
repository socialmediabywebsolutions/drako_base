import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/session";
import {
  listSaasCustomerBookingsForSaas,
  listSaasCustomers,
  resolveCustomersContext,
} from "@/lib/customers/repository";
import { listSaasServices, resolveEconomyContext } from "@/lib/economy/repository";
import type { SaasCustomerBooking } from "@/lib/customers/types";

export const runtime = "edge";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId");
    const employeeId = url.searchParams.get("employeeId");
    const day = url.searchParams.get("day") ?? "today";
    if (!saasId) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "saasId is required" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const customersCtx = await resolveCustomersContext({ tenantId, saasId });
    const [bookings, customers, economyCtx] = await Promise.all([
      listSaasCustomerBookingsForSaas(customersCtx, { employeeId, day }),
      listSaasCustomers(customersCtx),
      resolveEconomyContext({ tenantId, saasId }).catch(() => null),
    ]);

    const serviceMap =
      economyCtx &&
      (await listSaasServices(economyCtx).catch(() => []))?.reduce(
        (acc, service) => acc.set(service.id, service),
        new Map<string, { id: string; name: string; durationMinutes: number; currentPrice: number; recommendedPrice: number | null }>(),
      );

    const customerMap = new Map(customers.map((customer) => [customer.id, customer]));
    const items = bookings.map((booking) => {
      const customer = customerMap.get(booking.customerId);
      const service = serviceMap?.get(booking.serviceId);
      return {
        ...booking,
        customerName: customer?.fullName ?? "Cliente",
        customerIsVip: customer?.isVip ?? false,
        serviceName: service?.name,
        serviceDurationMinutes: service?.durationMinutes,
        servicePrice: service?.currentPrice ?? null,
      } satisfies SaasCustomerBooking & {
        customerName: string;
        customerIsVip: boolean;
        serviceName?: string;
        serviceDurationMinutes?: number;
        servicePrice?: number | null;
      };
    });

    return NextResponse.json({ items, count: items.length });
  } catch (error) {
    console.error("CUSTOMER_BOOKINGS_SAAS_LIST_ERROR", error);
    return NextResponse.json({ code: "CUSTOMERS_ERROR", message: "No se pudieron cargar las citas" }, { status: 500 });
  }
}
