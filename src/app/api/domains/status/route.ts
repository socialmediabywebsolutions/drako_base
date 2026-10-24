export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { ensureDatabase } from "@/lib/db";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { getDomainStatus } from "@/lib/domains/domain-service";

function resolveCorrelationId(request: Request): string {
    const header = request.headers.get("x-correlation-id")?.trim();
    if (header) return header;
    return globalThis.crypto?.randomUUID?.() ?? `domains_status_${Date.now()}`;
}

export async function GET(req: Request) {
    const correlationId = resolveCorrelationId(req);
    try {
        ensureDatabase();
        const { tenantId } = await requireTenantAccess(req);
        const { searchParams } = new URL(req.url);
        const saasId = searchParams.get("saasId");

        if (!saasId) {
            return NextResponse.json(
                {
                    ok: false,
                    code: "DOMAIN_STATUS_INVALID_INPUT",
                    message: "Missing saasId",
                    correlationId,
                },
                { status: 400 },
            );
        }

        const status = await getDomainStatus(tenantId, saasId, { correlationId });

        if (!status) {
            return NextResponse.json(
                {
                    ok: false,
                    code: "SAAS_NOT_FOUND",
                    message: "SaaS instance not found",
                    correlationId,
                },
                { status: 404 },
            );
        }

        return NextResponse.json({
            ok: true,
            code: "DOMAIN_STATUS_OK",
            message: "Domain status resolved",
            correlationId: status.correlationId,
            domain: status.custom_domain,
            status: status.status,
            trial_domain: status.trial_domain,
            custom_domain: status.custom_domain,
            verification: status.verification,
            last_checked: status.last_checked,
            error: status.error,
        });

    } catch (error) {
        if (error instanceof UnauthorizedError) {
            return NextResponse.json(
                { ok: false, code: "SESSION_REQUIRED", message: error.message, correlationId },
                { status: 401 },
            );
        }
        return NextResponse.json(
            { ok: false, code: "DOMAIN_STATUS_INTERNAL", message: "Internal Error", correlationId },
            { status: 500 },
        );
    }
}
