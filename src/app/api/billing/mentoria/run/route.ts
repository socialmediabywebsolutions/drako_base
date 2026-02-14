import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { MentoriaInvoicer } from '@/lib/billing/mentoria-invoicer';
import { authorizeSaasAccess } from '@/lib/authz/saas-access';
import { extractSessionFromRequest } from '@/lib/edge-auth';

// Edge runtime: Phase 21 Edge Auth migration complete
// export const runtime = 'edge'; // OpenNext: disabled for Cloudflare Pages compat

export async function POST(req: NextRequest) {
    const db = getDb();

    try {
        const body = await req.json() as any;
        const { saasId } = body;

        // Fail-closed validation
        if (!saasId) {
            return NextResponse.json({ error: 'saasId is required' }, { status: 400 });
        }

        // AuthZ: OWNER can run for any saasId, tenant users only for their own
        const session = await extractSessionFromRequest(req);
        const authResult = await authorizeSaasAccess(session, req, saasId);

        if (!authResult.authorized) {
            // Emit audit event for denied access
            try {
                await db!.prepare(
                    `INSERT INTO economic_events (id, saas_id, tenant_id, event_type, amount_major, metadata_json, created_at)
                     VALUES (?, ?, ?, 'INVOICE_RUN_DENIED', 0, ?, datetime('now'))`
                ).bind(
                    crypto.randomUUID(),
                    saasId,
                    'system',
                    JSON.stringify({
                        error: authResult.error || 'UNAUTHORIZED',
                        endpoint: '/api/billing/mentoria/run'
                    })
                ).run();
            } catch (e) {
                console.error('Failed to log INVOICE_RUN_DENIED event:', e);
            }

            return NextResponse.json({
                error: 'Unauthorized: ' + (authResult.error || 'Insufficient permissions')
            }, { status: 403 });
        }

        // Execute invoice run
        const invoicer = new MentoriaInvoicer(db);
        const result = await invoicer.createUsageInvoiceRun(saasId);

        return NextResponse.json(result);

    } catch (e: any) {
        console.error('Invoice Run Failed:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
