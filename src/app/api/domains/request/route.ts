export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { ensureDatabase } from "@/lib/db";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { requestCustomDomain } from "@/lib/domains/domain-service";
import { evaluateCustomDomainEntitlement } from "@/lib/domains/entitlement-gate";

export async function POST(req: Request) {
    try {
        ensureDatabase();
        const { tenantId } = await requireTenantAccess(req);
        const body = await req.json() as any;
        const { saasId, domain } = body;

        if (!saasId || !domain) {
            return NextResponse.json({ ok: false, error: "Missing saasId or domain" }, { status: 400 });
        }

        const entitlement = await evaluateCustomDomainEntitlement({ tenantId, saasId });
        if (!entitlement.allowed) {
            const status = entitlement.code === "SAAS_NOT_FOUND" ? 404 : 403;
            return NextResponse.json(
                { ok: false, error: entitlement.message, code: entitlement.code, context: entitlement.context },
                { status },
            );
        }

        const result = await requestCustomDomain(tenantId, saasId, domain);

        if (!result.ok) {
            return NextResponse.json({ ok: false, error: result.error, status: result.status }, { status: 400 });
        }

        return NextResponse.json({ ok: true, token: result.token, status: result.status });

    } catch (error) {
        if (error instanceof UnauthorizedError) return NextResponse.json({ error: error.message }, { status: 401 });
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
