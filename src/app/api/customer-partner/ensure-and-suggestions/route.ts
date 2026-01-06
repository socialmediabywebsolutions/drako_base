import { NextResponse } from "next/server";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { buildCustomerPartnerContext, getCustomerServiceSuggestions } from "@/lib/agents/customer-partner";
import {
  CustomersContextError,
  findOrCreateCustomerByContact,
  resolveCustomersContext,
  updateSaasCustomer,
} from "@/lib/customers/repository";


export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      saasId?: string | null;
      fullName?: string;
      email?: string | null;
      phone?: string | null;
      styleProfile?: Record<string, unknown> | null;
      referenceServiceId?: string | null;
      eventType?: string | null;
      budgetRange?: { min?: number | null; max?: number | null } | null;
    } | null;

    if (!body?.saasId || !body.fullName?.trim() || !body.email?.trim()) {
      return NextResponse.json(
        { code: "INVALID_BODY", message: "saasId, fullName and email are required" },
        { status: 400 },
      );
    }

    const { tenantId } = await requireTenantAccess(request);
    const customersCtx = await resolveCustomersContext({ tenantId, saasId: body.saasId });
    const customer = await findOrCreateCustomerByContact(customersCtx, {
      saasId: body.saasId,
      fullName: body.fullName.trim(),
      email: body.email.trim(),
      phone: body.phone?.trim() ?? null,
    });

    const updated = await updateSaasCustomer(customersCtx, customer.id, {
      saasId: body.saasId,
      fullName: body.fullName.trim(),
      email: body.email.trim(),
      phone: body.phone?.trim() ?? null,
      styleProfile: body.styleProfile ?? null,
    });

    const ctx = await buildCustomerPartnerContext({ tenantId, saasId: body.saasId, customerId: updated.id });
    const suggestions = getCustomerServiceSuggestions(ctx, {
      referenceServiceId: body.referenceServiceId ?? null,
      eventType: body.eventType ?? null,
      budgetRange: body.budgetRange ?? null,
    });
    const advice =
      suggestions.length > 0
        ? "Te preparamos opciones alineadas con tu estilo y presupuesto."
        : "Estamos revisando disponibilidad para recomendarte el mejor servicio.";

    return NextResponse.json({ customerId: updated.id, suggestions, advice });
  } catch (error) {
    if (error instanceof CustomersContextError) {
      return NextResponse.json({ code: "INVALID_CUSTOMERS_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("CUSTOMER_PARTNER_ENSURE_ERROR", error);
    return NextResponse.json({ code: "CUSTOMER_PARTNER_ERROR", message: "No se pudieron generar sugerencias" }, { status: 500 });
  }
}
