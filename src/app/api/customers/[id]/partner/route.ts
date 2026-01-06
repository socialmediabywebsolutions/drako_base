import { NextResponse } from "next/server";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { buildCustomerPartnerContext, getCustomerPartnerSuggestions } from "@/lib/agents/customer-partner";
import { CustomersContextError } from "@/lib/customers/repository";


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
    const context = await buildCustomerPartnerContext({ tenantId, saasId, customerId });
    const response = getCustomerPartnerSuggestions(context);
    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof CustomersContextError) {
      return NextResponse.json({ code: "INVALID_CUSTOMERS_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    if (error instanceof Error && error.message.toLowerCase().includes("not found")) {
      return NextResponse.json({ code: "NOT_FOUND", message: error.message }, { status: 404 });
    }
    console.error("CUSTOMER_PARTNER_ERROR", error);
    return NextResponse.json({ code: "CUSTOMER_PARTNER_ERROR", message: "No se pudo cargar el partner." }, { status: 500 });
  }
}
