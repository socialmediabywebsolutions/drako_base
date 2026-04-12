export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireOwnerAccess, UnauthorizedError } from "@/lib/auth/session";
import { sendOperatorRealtimeWhatsappAlert } from "@/lib/campamento-base/operator-whatsapp-notifications";

function readPayload(body: unknown, fallbackTenantId: string | null): {
  operatorTenantId: string | null;
  saasId: string | null;
} {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {
      operatorTenantId: fallbackTenantId?.trim() || null,
      saasId: null,
    };
  }

  const payload = body as Record<string, unknown>;
  const operatorTenantId = typeof payload.operatorTenantId === "string" && payload.operatorTenantId.trim()
    ? payload.operatorTenantId.trim()
    : fallbackTenantId?.trim() || null;
  const saasId = typeof payload.saasId === "string" && payload.saasId.trim()
    ? payload.saasId.trim()
    : null;

  return {
    operatorTenantId,
    saasId,
  };
}

function resolveStatus(error: unknown): number {
  if (error instanceof Error && error.message === "OPERATOR_WHATSAPP_OWNER_PHONE_MISSING") {
    return 424;
  }

  if (error instanceof Error && error.message.startsWith("OPERATOR_")) {
    return 400;
  }

  return 500;
}

export async function POST(request: Request) {
  try {
    const access = await requireOwnerAccess(request);
    const body = await request.json().catch(() => null);
    const payload = readPayload(body, access?.tenantId ?? null);

    if (!payload.operatorTenantId) {
      return NextResponse.json(
        { ok: false, code: "OPERATOR_TENANT_ID_REQUIRED", message: "operatorTenantId is required" },
        { status: 400 },
      );
    }

    if (!payload.saasId) {
      return NextResponse.json(
        { ok: false, code: "OPERATOR_WHATSAPP_SAAS_ID_REQUIRED", message: "saasId is required" },
        { status: 400 },
      );
    }

    const result = await sendOperatorRealtimeWhatsappAlert({
      operatorTenantId: payload.operatorTenantId,
      saasId: payload.saasId,
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }

    const status = resolveStatus(error);
    return NextResponse.json(
      {
        ok: false,
        code: error instanceof Error ? error.message : "OPERATOR_WHATSAPP_REALTIME_ALERT_ERROR",
        message: error instanceof Error ? error.message : "Operator WhatsApp realtime alert failed",
      },
      { status },
    );
  }
}
