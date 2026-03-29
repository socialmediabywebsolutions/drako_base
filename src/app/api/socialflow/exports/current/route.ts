export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { ensureDatabase, run } from "@/lib/db";
import { respondDatabaseError } from "@/lib/http/errors";
import { getCurrentSocialFlowSession } from "@/lib/socialflow/auth/server";
import { generateSocialFlowExportForTenant } from "@/lib/socialflow/export";

export async function GET() {
  try {
    ensureDatabase();
    const session = await getCurrentSocialFlowSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: "SESSION_REQUIRED" }, { status: 401 });
    }

    const { buffer, filename } = await generateSocialFlowExportForTenant(session.tenantId);

    await run(
      "INSERT INTO economic_events (id, tenant_id, saas_id, type, severity, payload_json, created_at) VALUES (?, ?, ?, 'EXPORT_GENERATED', 'info', ?, datetime('now'))",
      globalThis.crypto.randomUUID(),
      session.tenantId,
      null,
      JSON.stringify({
        actor: session.email,
        filename,
        size_bytes: buffer.byteLength,
        source: "socialflow.exports.current",
      }),
    );

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
