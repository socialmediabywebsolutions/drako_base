export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireOwnerAccess, UnauthorizedError } from "@/lib/auth/session";
import { FactoryRecoveryOperationError, requestRetryJobOperation } from "@/lib/factory/recovery-operations";

function resolveCorrelationId(request: Request): string | null {
  return request.headers.get("x-correlation-id") ?? request.headers.get("x-drako-correlation-id");
}

export async function POST(request: Request) {
  try {
    const access = await requireOwnerAccess(request);
    if (!access?.tenantId) {
      throw new UnauthorizedError("SESSION_REQUIRED", 401);
    }
    const { tenantId } = access;
    const body = await request.json().catch(() => null) as { jobId?: unknown } | null;
    const result = await requestRetryJobOperation({
      tenantId,
      jobId: body?.jobId,
      correlationId: resolveCorrelationId(request),
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        { ok: false, code: error.message, message: error.message },
        { status: error.status },
      );
    }

    if (error instanceof FactoryRecoveryOperationError) {
      return NextResponse.json(
        { ok: false, code: error.code, message: error.message },
        { status: error.status },
      );
    }

    console.error("OWNER_FACTORY_RETRY_JOB_ERROR", error);
    return NextResponse.json(
      { ok: false, code: "OWNER_FACTORY_RETRY_JOB_ERROR", message: "Failed to request job retry" },
      { status: 500 },
    );
  }
}
