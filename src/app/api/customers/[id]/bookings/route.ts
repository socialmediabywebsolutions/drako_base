import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/session";
import {
  createSaasCustomerBooking,
  listSaasCustomerBookings,
  resolveCustomersContext,
  updateSaasCustomerBookingStatus,
} from "@/lib/customers/repository";
import type { CustomerBookingStatus } from "@/lib/customers/types";
import { listSaasServices, resolveEconomyContext } from "@/lib/economy/repository";


type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId");
    const { id: customerId } = await params;
    if (!saasId || !customerId) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "saasId and customerId are required" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const customersCtx = await resolveCustomersContext({ tenantId, saasId });
    const [bookings, economyCtx] = await Promise.all([
      listSaasCustomerBookings(customersCtx, customerId),
      resolveEconomyContext({ tenantId, saasId }).catch(() => null),
    ]);
    const servicesMap =
      economyCtx && (await listSaasServices(economyCtx).catch(() => []))?.reduce(
        (acc, service) => acc.set(service.id, service),
        new Map<string, { id: string; name: string; durationMinutes: number; currentPrice: number; recommendedPrice: number | null }>(),
      );

    const items = bookings.map((booking) => {
      const service = servicesMap?.get(booking.serviceId);
      return service
        ? { ...booking, service }
        : {
            ...booking,
          };
    });
    return NextResponse.json({ items, count: items.length });
  } catch (error) {
    console.error("CUSTOMER_BOOKINGS_LIST_ERROR", error);
    return NextResponse.json({ code: "CUSTOMERS_ERROR", message: "No se pudieron cargar las citas" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const body = (await request.json().catch(() => null)) as {
      saasId?: string | null;
      serviceId?: string;
      employeeId?: string | null;
      startTime?: string;
      endTime?: string;
      status?: string;
      priceAtBooking?: number | null;
      notes?: string | null;
    } | null;
    const { id: customerId } = await params;
    if (!body?.saasId || !customerId || !body.serviceId || !body.startTime || !body.endTime) {
      return NextResponse.json(
        { code: "INVALID_BODY", message: "saasId, serviceId, startTime, and endTime are required" },
        { status: 400 },
      );
    }
    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveCustomersContext({ tenantId, saasId: body.saasId });
    const status = (body.status as CustomerBookingStatus | undefined) ?? "REQUESTED";
    const booking = await createSaasCustomerBooking(ctx, {
      saasId: body.saasId,
      customerId,
      serviceId: body.serviceId,
      employeeId: body.employeeId ?? null,
      startTime: body.startTime,
      endTime: body.endTime,
      status,
      priceAtBooking: typeof body.priceAtBooking === "number" ? body.priceAtBooking : null,
      notes: body.notes ?? null,
    });
    return NextResponse.json({ booking });
  } catch (error) {
    console.error("CUSTOMER_BOOKINGS_CREATE_ERROR", error);
    return NextResponse.json({ code: "CUSTOMERS_ERROR", message: "No se pudo crear la cita" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const body = (await request.json().catch(() => null)) as { saasId?: string | null; bookingId?: string; status?: string } | null;
    const { id: customerId } = await params;
    if (!body?.saasId || !customerId || !body.bookingId || !body.status) {
      return NextResponse.json({ code: "INVALID_BODY", message: "saasId, bookingId and status are required" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveCustomersContext({ tenantId, saasId: body.saasId });
    const booking = await updateSaasCustomerBookingStatus(ctx, body.bookingId, body.status as CustomerBookingStatus);
    return NextResponse.json({ booking });
  } catch (error) {
    console.error("CUSTOMER_BOOKINGS_UPDATE_ERROR", error);
    return NextResponse.json({ code: "CUSTOMERS_ERROR", message: "No se pudo actualizar la cita" }, { status: 500 });
  }
}
