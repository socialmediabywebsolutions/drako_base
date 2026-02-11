import { NextResponse } from "next/server";
import { ensureDatabase, run } from "@/lib/db";
import { authorizeSaasAccess, requireTenant } from "@/lib/authz/saas-access";
import { extractSessionFromRequest } from "@/lib/edge-auth";
import { UnauthorizedError } from "@/lib/auth/session"; // Keep error type if convenient, or use standard
import { generateWipeoutPackage } from "@/lib/campamento-base/export-engine/wipeout";

import { respondDatabaseError } from "@/lib/http/errors";

// Edge runtime: Phase 21 Edge Auth migration complete
export const runtime = "edge";

function authErrorResponse(error: unknown) {
    if (error instanceof Error && error.message.includes("FORBIDDEN")) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    }
    return null;
}

export async function GET(req: Request) {
    try {
        ensureDatabase();

        // 1. Auth & Tenant Access (Strict Isolation)
        const session = await extractSessionFromRequest(req);
        const access = await authorizeSaasAccess(session, { headers: req.headers } as any);
        requireTenant(access);

        const tenantId = access.tenantId!;
        const { searchParams } = new URL(req.url);
        const saasId = searchParams.get("saasId");

        // Extra check: If saasId provided, usually we trust tenant isolation, 
        // but if we want to be super strict we could check if saasId belongs to tenantId.
        // For export, strict tenant isolation is enough.

        if (!saasId) {
            return NextResponse.json({ ok: false, error: "saasId is required" }, { status: 400 });
        }

        // 2. Generate Package
        const { buffer, filename } = await generateWipeoutPackage(saasId, tenantId);

        // 3. Log Event (Audit)
        const eventId = globalThis.crypto.randomUUID();
        await run(
            "INSERT INTO economic_events (id, tenant_id, saas_id, type, severity, payload_json, created_at) VALUES (?, ?, ?, 'EXPORT_GENERATED', 'info', ?, datetime('now'))",
            eventId,
            tenantId,
            saasId,
            eventId,
            tenantId,
            saasId,
            JSON.stringify({
                actor: access.email || "unknown",
                filename,
                size_bytes: buffer.byteLength
            })
        );

        // 4. Return Download
        return new NextResponse(buffer as any, {
            status: 200,
            headers: {
                "Content-Type": "application/zip",
                "Content-Disposition": `attachment; filename="${filename}"`,
                "Content-Length": buffer.byteLength.toString(),
            },
        });

    } catch (error) {
        const response = authErrorResponse(error);
        if (response) return response;

        const dbError = respondDatabaseError(error);
        if (dbError) return dbError;

        // Handle "SaaS not found" specifically if it comes from wipeout
        if (error instanceof Error && error.message.includes("not found")) {
            return NextResponse.json({ ok: false, error: error.message }, { status: 404 });
        }

        const correlationId = globalThis.crypto?.randomUUID?.() ?? `export_err_${Date.now()}`;
        console.error("SAAS_EXPORT_ERROR", correlationId, error);
        return NextResponse.json(
            { ok: false, error: "Internal export error", error_code: "EXPORT_FAILED", correlation_id: correlationId },
            { status: 500 }
        );
    }
}
