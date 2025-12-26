import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/session";
import { handleEconomyApiError } from "@/lib/economy/api-helpers";
import { recordInventoryMovement, resolveEconomyContext } from "@/lib/economy/repository";
import type { SaasInventoryMovement } from "@/lib/economy/types";

export const runtime = "edge";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      saasId?: string;
      inventoryItemId?: string;
      type?: SaasInventoryMovement["type"];
      quantity?: number;
      reason?: string | null;
      source?: SaasInventoryMovement["source"] | null;
      relatedServiceId?: string | null;
      relatedEmployeeId?: string | null;
    } | null;
    if (!body?.saasId || !body.inventoryItemId || !body.type || typeof body.quantity !== "number") {
      return NextResponse.json(
        { code: "INVALID_BODY", message: "saasId, inventoryItemId, type, and quantity are required" },
        { status: 400 },
      );
    }
    const { tenantId } = await requireTenantAccess(request);
    const context = await resolveEconomyContext({ tenantId, saasId: body.saasId });
    const movement = await recordInventoryMovement(context, {
      saasId: body.saasId,
      inventoryItemId: body.inventoryItemId,
      type: body.type,
      quantity: body.quantity,
      reason: body.reason ?? null,
      source: body.source ?? null,
      relatedServiceId: body.relatedServiceId ?? null,
      relatedEmployeeId: body.relatedEmployeeId ?? null,
    });
    return NextResponse.json({ movement });
  } catch (error) {
    return handleEconomyApiError("ECONOMY_INVENTORY_MOVEMENT_POST", error);
  }
}
