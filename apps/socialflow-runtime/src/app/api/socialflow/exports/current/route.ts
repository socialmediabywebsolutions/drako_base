export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getCurrentSocialFlowSession } from "../../../../../lib/auth/session";
import { respondDatabaseError } from "../../../../../lib/db/runtime-db";
import { generateRuntimeSocialFlowExportForTenant } from "../../../../../lib/socialflow/exports-service";

export async function GET() {
  try {
    const session = await getCurrentSocialFlowSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: "SESSION_REQUIRED" }, { status: 401 });
    }

    const { buffer, filename } = await generateRuntimeSocialFlowExportForTenant(session.tenantId);

    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": buffer.byteLength.toString(),
      },
    });
  } catch (error) {
    const dbError = respondDatabaseError(error);
    if (dbError) return dbError;
    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 404 });
    }
    console.error("SOCIALFLOW_RUNTIME_EXPORT_CURRENT_ERROR", error);
    return NextResponse.json({ ok: false, error: "EXPORT_FAILED" }, { status: 500 });
  }
}
