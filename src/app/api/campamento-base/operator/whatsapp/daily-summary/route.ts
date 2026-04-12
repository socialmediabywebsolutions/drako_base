export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireOwnerAccess, UnauthorizedError } from "@/lib/auth/session";
import { sendOperatorDailyWhatsappSummary } from "@/lib/campamento-base/operator-whatsapp-notifications";

function readOperatorTenantId(body: unknown, fallbackTenantId: string | null): string | null {
  if (body && typeof body === "object" && !Array.isArray(body)) {
    const payload = body as Record<string, unknown>;
    const candidate = typeof payload.operatorTenantId === "string" ? payload.operatorTenantId.trim() : "";
    if (candidate) {
      return candidate;
    }
  }

  return fallbackTenantId?.trim() || null;
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
    const operatorTenantId = readOperatorTenantId(body, access?.tenantId ?? null);

    if (!operatorTenantId) {
      return NextResponse.json(
        { ok: false, code: "OPERATOR_TENANT_ID_REQUIRED", message: "operatorTenantId is required" },
        { status: 400 },
      );
    }

    const result = await sendOperatorDailyWhatsappSummary({ operatorTenantId });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }

    const status = resolveStatus(error);
    return NextResponse.json(
      {
        ok: false,
        code: error instanceof Error ? error.message : "OPERATOR_WHATSAPP_DAILY_SUMMARY_ERROR",
        message: error instanceof Error ? error.message : "Operator WhatsApp daily summary failed",
      },
      { status },
    );
  }
}
