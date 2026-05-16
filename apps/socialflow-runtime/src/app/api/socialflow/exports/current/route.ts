export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getCurrentSocialFlowSession } from "../../../../../lib/auth/session";
import { respondDatabaseError } from "../../../../../lib/db/runtime-db";
import { addRuntimeHeaders, getRuntimeCorrelationId, logRuntimeEvent } from "../../../../../lib/runtime-observability";
import { generateRuntimeSocialFlowExportForTenant } from "../../../../../lib/socialflow/exports-service";

export async function GET(request: Request) {
  const correlationId = getRuntimeCorrelationId(request);
  try {
    const session = await getCurrentSocialFlowSession();
    if (!session) {
      logRuntimeEvent("warn", "export_session_required", { correlationId });
      return addRuntimeHeaders(NextResponse.json({ ok: false, error: "SESSION_REQUIRED" }, { status: 401 }), {
        request,
        correlationId,
      });
    }

    const { buffer, filename } = await generateRuntimeSocialFlowExportForTenant(session.tenantId);
    logRuntimeEvent("log", "export_generated_success", {
      correlationId,
      tenantId: session.tenantId,
      filename,
      sizeBytes: buffer.byteLength,
    });

    return addRuntimeHeaders(new NextResponse(buffer as any, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": buffer.byteLength.toString(),
      },
    }), { request, correlationId });
  } catch (error) {
    const dbError = respondDatabaseError(error, request);
    if (dbError) return dbError;
    if (error instanceof Error && error.message.includes("not found")) {
      return addRuntimeHeaders(NextResponse.json({ ok: false, error: error.message }, { status: 404 }), {
        request,
        correlationId,
      });
    }
    logRuntimeEvent("error", "export_failed", {
      correlationId,
      message: error instanceof Error ? error.message : String(error),
    });
    return addRuntimeHeaders(NextResponse.json({ ok: false, error: "EXPORT_FAILED" }, { status: 500 }), {
      request,
      correlationId,
    });
  }
}
