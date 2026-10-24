export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { ensureDatabase } from "@/lib/db";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { DomainServiceError, verifyAndActivate } from "@/lib/domains/domain-service";
import { evaluateCustomDomainEntitlement } from "@/lib/domains/entitlement-gate";

function resolveCorrelationId(request: Request): string {
    const header = request.headers.get("x-correlation-id")?.trim();
    if (header) return header;
    return globalThis.crypto?.randomUUID?.() ?? `domains_verify_${Date.now()}`;
}

export async function POST(req: Request) {
    const correlationId = resolveCorrelationId(req);
    try {
        ensureDatabase();
        const { tenantId } = await requireTenantAccess(req);
        const body = await req.json() as any;
        const { saasId } = body;

        if (!saasId) {
            return NextResponse.json(
                {
                    ok: false,
                    code: "DOMAIN_VERIFY_INVALID_INPUT",
                    message: "Missing saasId",
                    correlationId,
                },
                { status: 400 },
            );
        }

        const entitlement = await evaluateCustomDomainEntitlement({ tenantId, saasId });
        if (!entitlement.allowed) {
            const status = entitlement.code === "SAAS_NOT_FOUND" ? 404 : 403;
            return NextResponse.json(
                {
                    ok: false,
                    code: entitlement.code,
                    message: entitlement.message,
                    correlationId,
                    context: entitlement.context,
                    status: entitlement.code === "SAAS_NOT_FOUND" ? "none" : "locked",
                },
                { status },
            );
        }

        const result = await verifyAndActivate(tenantId, saasId, { correlationId });
        const status = result.httpStatus ?? (result.ok ? 200 : 400);
        return NextResponse.json(
            {
                ok: result.ok,
                code: result.code,
                message: result.message,
                correlationId: result.correlationId,
                domain: result.domain ?? null,
                status: result.status,
                prevStatus: result.prevStatus,
                newStatus: result.newStatus,
            },
            { status },
        );

    } catch (error) {
        if (error instanceof UnauthorizedError) {
            return NextResponse.json(
                { ok: false, code: "SESSION_REQUIRED", message: error.message, correlationId },
                { status: 401 },
            );
        }
        if (error instanceof DomainServiceError) {
            return NextResponse.json(
                {
                    ok: false,
                    code: error.code,
                    message: error.message,
                    correlationId: error.correlationId,
                },
                { status: error.httpStatus },
            );
        }
        return NextResponse.json(
            { ok: false, code: "DOMAIN_VERIFY_INTERNAL", message: "Internal Error", correlationId },
            { status: 500 },
        );
    }
}
