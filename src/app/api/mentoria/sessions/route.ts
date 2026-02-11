import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { MentorSessionEngine } from '@/lib/mentoria/session-engine';
import { authorizeSaasAccess } from '@/lib/authz/saas-access';
import { extractSessionFromRequest } from '@/lib/edge-auth';

// TEMP: Node.js runtime until Phase 21 Edge Auth migration complete
// Issue: next-auth → crypto polyfill incompatible with Edge runtime
export const runtime = 'nodejs';

/**
 * GET /api/mentoria/sessions
 * Returns sessions for current tenant's billing cycle + usage stats
 */
export async function GET(req: NextRequest) {
    const db = getDb();
    if (!db) {
        return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    }

    try {
        // AuthZ: Extract tenantId from session
        const session = await extractSessionFromRequest(req);
        const authResult = await authorizeSaasAccess(session, req);

        if (!authResult.authorized || !authResult.tenantId) {
            return NextResponse.json({
                error: 'Unauthorized'
            }, { status: 403 });
        }

        const tenantId = authResult.tenantId;

        // Get SaaS instance for billing cycle info
        const saas = await db.prepare(
            `SELECT id, billing_cycle_start, billing_cycle_end, included_sessions 
             FROM saas_instances 
             WHERE tenant_id = ? AND slug = 'mentoria'`
        ).bind(tenantId).first();

        if (!saas) {
            return NextResponse.json({
                error: 'MentorIA instance not found for tenant'
            }, { status: 404 });
        }

        const cycleStart = saas.billing_cycle_start;
        const cycleEnd = saas.billing_cycle_end;
        const includedLimit = saas.included_sessions || 10;

        // Get sessions for current billing cycle
        const sessions = await db.prepare(
            `SELECT id, mentor_id, client_id, status, duration_minutes, 
                    ai_tokens_used, cost_est_major, created_at, completed_at, billed_at
             FROM mentoria_sessions
             WHERE tenant_id = ? 
               AND created_at >= ? 
               AND created_at < ?
             ORDER BY created_at DESC`
        ).bind(tenantId, cycleStart, cycleEnd).all();

        const sessionList = sessions.results || [];

        // Calculate cycle stats
        const completedCount = sessionList.filter((s: any) => s.status === 'completed' || s.status === 'billed').length;
        const overageCount = Math.max(0, completedCount - includedLimit);

        return NextResponse.json({
            sessions: sessionList,
            cycle: {
                start: cycleStart,
                end: cycleEnd,
                included_limit: includedLimit,
                used_count: completedCount,
                overage_count: overageCount
            }
        });

    } catch (e: any) {
        console.error('[GET /api/mentoria/sessions]:', e);
        return NextResponse.json({
            error: e.message
        }, { status: 500 });
    }
}

/**
 * POST /api/mentoria/sessions
 * Create a new session (if self-service enabled)
 */
export async function POST(req: NextRequest) {
    const db = getDb();
    if (!db) {
        return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    }

    try {
        // AuthZ
        const session = await extractSessionFromRequest(req);
        const authResult = await authorizeSaasAccess(session, req);

        if (!authResult.authorized || !authResult.tenantId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const body = await req.json() as any;
        const { mentorId, clientId, topic } = body;

        if (!mentorId || !clientId) {
            return NextResponse.json({
                error: 'mentorId and clientId required'
            }, { status: 400 });
        }

        const engine = new MentorSessionEngine(db);
        const id = await engine.createSession(mentorId, clientId, { topic });

        return NextResponse.json({ success: true, id }, { status: 201 });

    } catch (e: any) {
        console.error('[POST /api/mentoria/sessions]:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
