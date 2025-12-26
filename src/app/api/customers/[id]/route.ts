import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/session";
import {
  getSaasCustomer,
  getSaasCustomerMetrics,
  getSaasCustomerProfile,
  resolveCustomersContext,
  upsertSaasCustomer,
  upsertSaasCustomerProfile,
} from "@/lib/customers/repository";

export const runtime = "edge";

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
    const ctx = await resolveCustomersContext({ tenantId, saasId });
    const [customer, profile, metrics] = await Promise.all([
      getSaasCustomer(ctx, customerId),
      getSaasCustomerProfile(ctx, customerId),
      getSaasCustomerMetrics(ctx, customerId),
    ]);
    if (!customer) {
      return NextResponse.json({ code: "NOT_FOUND", message: "Cliente no encontrado" }, { status: 404 });
    }
    return NextResponse.json({ customer, profile, metrics });
  } catch (error) {
    console.error("CUSTOMER_DETAIL_ERROR", error);
    return NextResponse.json({ code: "CUSTOMERS_ERROR", message: "No se pudo cargar el cliente" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const body = (await request.json().catch(() => null)) as {
      saasId?: string | null;
      fullName?: string;
      email?: string | null;
      phone?: string | null;
      notes?: string | null;
      preferredEmployeeId?: string | null;
      preferredServices?: string[] | null;
      styleProfile?: Record<string, unknown> | null;
      isVip?: boolean;
      vipLevel?: "REGULAR" | "VIP" | "VVIP";
      profile?: {
        tags?: string[] | null;
        preferences?: Record<string, unknown> | null;
        birthday?: string | null;
        styleProfile?: Record<string, unknown> | null;
        lastStyleReviewAt?: string | null;
        metadata?: Record<string, unknown> | null;
      };
    } | null;
    const { id: customerId } = await params;
    if (!body?.saasId || !customerId) {
      return NextResponse.json({ code: "INVALID_BODY", message: "saasId and customerId are required" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveCustomersContext({ tenantId, saasId: body.saasId });
    const [current, currentProfile] = await Promise.all([getSaasCustomer(ctx, customerId), getSaasCustomerProfile(ctx, customerId)]);
    if (!current) {
      return NextResponse.json({ code: "NOT_FOUND", message: "Cliente no encontrado" }, { status: 404 });
    }
    const customer = await upsertSaasCustomer(ctx, {
      id: customerId,
      saasId: body.saasId,
      fullName: body.fullName?.trim() ?? current.fullName,
      email: typeof body.email === "undefined" ? null : body.email,
      phone: typeof body.phone === "undefined" ? null : body.phone,
      notes: typeof body.notes === "undefined" ? null : body.notes,
      preferredEmployeeId: typeof body.preferredEmployeeId === "undefined" ? null : body.preferredEmployeeId,
      preferredServices: typeof body.preferredServices === "undefined" ? null : body.preferredServices,
      styleProfile: typeof body.styleProfile === "undefined" ? null : body.styleProfile,
      isVip: body.isVip,
      vipLevel: body.vipLevel ?? current.vipLevel,
    });
    let profile = null;
    if (body.profile) {
      profile = await upsertSaasCustomerProfile(ctx, {
        id: currentProfile?.id,
        customerId,
        saasId: body.saasId,
        tags: body.profile.tags ?? null,
        preferences: body.profile.preferences ?? null,
        birthday: body.profile.birthday ?? null,
        styleProfile: body.profile.styleProfile ?? null,
        lastStyleReviewAt: body.profile.lastStyleReviewAt ?? null,
        metadata: body.profile.metadata ?? null,
      });
    }
    const metrics = await getSaasCustomerMetrics(ctx, customerId);
    return NextResponse.json({ customer, profile, metrics });
  } catch (error) {
    console.error("CUSTOMER_UPDATE_ERROR", error);
    return NextResponse.json({ code: "CUSTOMERS_ERROR", message: "No se pudo actualizar el cliente" }, { status: 500 });
  }
}
