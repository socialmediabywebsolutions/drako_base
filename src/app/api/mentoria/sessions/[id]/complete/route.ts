export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { getDracoDbFromRequestContext } from '@/lib/db';
import { MentorSessionEngine } from '@/lib/mentoria/session-engine';
import { resolveAuthsContextFromRequest } from '@/lib/auths/contexts';
import { extractSessionFromRequest } from '@/lib/edge-auth';
import { authorizeSaasAccess } from '@/lib/authz/saas-access';



export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const db = getDracoDbFromRequestContext();
    if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

    if (resolveAuthsContextFromRequest(req) !== "mentorias") {
        return NextResponse.json({ error: "Mentorias context required" }, { status: 401 });
    }

    try {
        const { id } = await params;
        const session = await extractSessionFromRequest(req);
        const authResult = await authorizeSaasAccess(session, req);
        if (!authResult.authorized || !authResult.tenantId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }
        const body = await req.json();
        const { duration, tokens } = body as any;

        const engine = new MentorSessionEngine(db, authResult.tenantId, "mentoria-global");
        await engine.completeSession(id, duration, tokens);

        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
