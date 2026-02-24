export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { buildCustomerPartnerContext, getCustomerServiceSuggestions } from "@/lib/agents/customer-partner";
import { CustomersContextError } from "@/lib/customers/repository";



type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId");
    const referenceServiceId = url.searchParams.get("referenceServiceId");
    const eventType = url.searchParams.get("eventType");
    const budgetMin = url.searchParams.get("budgetMin");
    const budgetMax = url.searchParams.get("budgetMax");
    const { id: customerId } = await params;
    if (!saasId || !customerId) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "saasId and customerId are required" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const ctx = await buildCustomerPartnerContext({ tenantId, saasId, customerId });
    const minValue = budgetMin ? Number(budgetMin) : null;
    const maxValue = budgetMax ? Number(budgetMax) : null;
    const suggestions = getCustomerServiceSuggestions(ctx, {
      referenceServiceId: referenceServiceId ?? null,
      eventType: eventType ?? null,
      budgetRange: {
        min: Number.isFinite(minValue ?? NaN) ? minValue : null,
        max: Number.isFinite(maxValue ?? NaN) ? maxValue : null,
      },
    });
    return NextResponse.json({ suggestions });
  } catch (error) {
    if (error instanceof CustomersContextError) {
      return NextResponse.json({ code: "INVALID_CUSTOMERS_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("CUSTOMER_SUGGESTIONS_ERROR", error);
    return NextResponse.json({ code: "CUSTOMERS_ERROR", message: "No se pudieron cargar sugerencias" }, { status: 500 });
  }
}
