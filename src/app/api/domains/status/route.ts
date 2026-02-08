import { NextResponse } from "next/server";
import { ensureDatabase } from "@/lib/db";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { getDomainStatus } from "@/lib/domains/domain-service";

export async function GET(req: Request) {
    try {
        ensureDatabase();
        const { tenantId } = await requireTenantAccess(req);
        const { searchParams } = new URL(req.url);
        const saasId = searchParams.get("saasId");

        if (!saasId) {
            return NextResponse.json({ ok: false, error: "Missing saasId" }, { status: 400 });
        }

        const status = await getDomainStatus(tenantId, saasId);

        if (!status) {
            return NextResponse.json({ ok: false, error: "SaaS instance not found" }, { status: 404 });
        }

        return NextResponse.json({ ok: true, ...status });

    } catch (error) {
        if (error instanceof UnauthorizedError) return NextResponse.json({ error: error.message }, { status: 401 });
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
