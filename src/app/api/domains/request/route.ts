export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { ensureDatabase } from "@/lib/db";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { DomainServiceError, requestCustomDomain } from "@/lib/domains/domain-service";
import { evaluateCustomDomainEntitlement } from "@/lib/domains/entitlement-gate";

function resolveCorrelationId(request: Request): string {
    const header = request.headers.get("x-correlation-id")?.trim();
    if (header) return header;
    return globalThis.crypto?.randomUUID?.() ?? `domains_req_${Date.now()}`;
}

export async function POST(req: Request) {
    const correlationId = resolveCorrelationId(req);
    try {
        ensureDatabase();
        const { tenantId } = await requireTenantAccess(req);
        const body = await req.json() as any;
        const { saasId, domain } = body;

        if (!saasId || !domain) {
            return NextResponse.json(
                {
                    ok: false,
                    code: "DOMAIN_REQUEST_INVALID_INPUT",
                    message: "Missing saasId or domain",
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
                    domain,
                },
                { status },
            );
        }

        const result = await requestCustomDomain(tenantId, saasId, domain, { correlationId });
        const statusCode = result.httpStatus ?? (result.ok ? 202 : 400);

        if (!result.ok) {
            return NextResponse.json(
                {
                    ok: false,
                    code: result.code,
                    message: result.message,
                    correlationId: result.correlationId,
                    domain: result.domain ?? domain,
                    status: result.status,
                },
                { status: statusCode },
            );
        }

        return NextResponse.json(
            {
                ok: true,
                code: result.code,
                message: result.message,
                correlationId: result.correlationId,
                domain: result.domain ?? domain,
                status: result.status,
                token: result.token ?? null,
                idempotent: Boolean(result.idempotent),
            },
            { status: statusCode },
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
            { ok: false, code: "DOMAIN_REQUEST_INTERNAL", message: "Internal Error", correlationId },
            { status: 500 },
        );
    }
}
