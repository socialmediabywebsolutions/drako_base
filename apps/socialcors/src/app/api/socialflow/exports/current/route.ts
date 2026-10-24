export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { respondDatabaseError } from "@/lib/http/errors";
import { getCurrentSocialFlowSession } from "@/lib/socialflow/auth/server";
import { createGlobalSocialFlowExportCoreReadContract } from "@/lib/socialflow/contracts/export-core-read";
import { generateSocialFlowExportForTenant } from "@/lib/socialflow/export";

export async function GET() {
  try {
    const coreReadContract = createGlobalSocialFlowExportCoreReadContract();
    const session = await getCurrentSocialFlowSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: "SESSION_REQUIRED" }, { status: 401 });
    }

    const { buffer, filename } = await generateSocialFlowExportForTenant(session.tenantId);

    await coreReadContract.recordExportGeneratedEvent({
      tenantId: session.tenantId,
      saasId: null,
      payloadJson: JSON.stringify({
        actor: session.email,
        filename,
        size_bytes: buffer.byteLength,
        source: "socialflow.exports.current",
      }),
    });

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
    console.error("SOCIALFLOW_EXPORT_CURRENT_ERROR", error);
    return NextResponse.json({ ok: false, error: "EXPORT_FAILED" }, { status: 500 });
  }
}
