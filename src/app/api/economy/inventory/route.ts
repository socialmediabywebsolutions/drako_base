export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/session";
import { handleEconomyApiError } from "@/lib/economy/api-helpers";
import { listSaasInventoryItems, resolveEconomyContext, upsertSaasInventoryItem } from "@/lib/economy/repository";


export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId");
    if (!saasId) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "saasId is required" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const context = await resolveEconomyContext({ tenantId, saasId });
    const items = await listSaasInventoryItems(context);
    return NextResponse.json({ items, count: items.length });
  } catch (error) {
    return handleEconomyApiError("ECONOMY_INVENTORY_GET", error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      id?: string;
      saasId?: string;
      name?: string;
      sku?: string | null;
      category?: string | null;
      unit?: string | null;
      costPerUnit?: number;
      stockQuantity?: number;
      minStockQuantity?: number;
      preferredSupplier?: string | null;
      metadata?: Record<string, unknown> | null;
    } | null;
    if (!body?.saasId || !body.name || typeof body.costPerUnit !== "number") {
      return NextResponse.json(
        { code: "INVALID_BODY", message: "saasId, name, and costPerUnit are required" },
        { status: 400 },
      );
    }
    const { tenantId } = await requireTenantAccess(request);
    const context = await resolveEconomyContext({ tenantId, saasId: body.saasId });
    const item = await upsertSaasInventoryItem(context, {
      id: body.id,
      saasId: body.saasId,
      name: body.name,
      sku: body.sku ?? null,
      category: body.category ?? null,
      unit: body.unit ?? null,
      costPerUnit: body.costPerUnit,
      stockQuantity: body.stockQuantity,
      minStockQuantity: body.minStockQuantity,
      preferredSupplier: body.preferredSupplier ?? null,
      metadata: body.metadata ?? null,
    });
    return NextResponse.json({ item });
  } catch (error) {
    return handleEconomyApiError("ECONOMY_INVENTORY_POST", error);
  }
}
