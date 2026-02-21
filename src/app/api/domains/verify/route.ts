import { NextResponse } from "next/server";
import { ensureDatabase } from "@/lib/db";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { verifyAndActivate } from "@/lib/domains/domain-service";

export async function POST(req: Request) {
    try {
        ensureDatabase();
        const { tenantId } = await requireTenantAccess(req);
        const body = await req.json() as any;
        const { saasId } = body;

        if (!saasId) {
            return NextResponse.json({ ok: false, error: "Missing saasId" }, { status: 400 });
        }

        const result = await verifyAndActivate(tenantId, saasId, true); // Force check

        return NextResponse.json({ ok: true, ...result });

    } catch (error) {
        if (error instanceof UnauthorizedError) return NextResponse.json({ error: error.message }, { status: 401 });
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
