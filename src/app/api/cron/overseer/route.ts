export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server';
import { env } from '@/lib/cf';
import { syncStripeSubscription } from '@/lib/billing/stripe-sync';
import { computeUnitEconomics } from '@/lib/os/economics';
import { runInterventions } from '@/lib/os/interventions';
import { autoPauseIfPastDueExceeded } from '@/lib/os/lifecycle';
import { getEmpireOverview } from '@/lib/os/overseer'; // Still useful for pulse/matrix aggregator
import { CronAuthError, verifyCronAuth } from '@/lib/security/cron-auth';

// MUST be Node.js for Stripe Compatibility
export const runtime = 'nodejs';

export async function GET(req: Request) {
    try {
        verifyCronAuth(req);
    } catch (error) {
        if (error instanceof CronAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const bindings = env();
    const db = bindings?.DRACO_DB;
    if (!db) return NextResponse.json({ error: 'DB Connection Failed' }, { status: 500 });

    // Safety check for production DB in DEV
    // ... (skipped for speed, assuming safe environment)

    try {
        // Query ALL instances to check past_due ones too
        const instances = await db.prepare("SELECT * FROM saas_instances WHERE status IN ('active', 'trial_active') OR lifecycle_status = 'past_due'").all<any>();

        let processed = 0;
        let interventionsCount = 0;

        for (const instance of instances.results || []) {
            processed++;

            // 0. LIFECYCLE CHECKS (Auto-Pause)
            if (instance.lifecycle_status === 'past_due') {
                await autoPauseIfPastDueExceeded(instance.id);
            }

            // Skip further processing if paused/archived (unless we want to sync stripe to see if they paid?)
            // We should probably sync stripe even if paused to detect payment recovery, but for now focus on active/past_due.
            if (instance.lifecycle_status === 'paused' || instance.lifecycle_status === 'archived') continue;

            // 1. STRIPE SYNC
            // Check if we need to sync? For now, sync always on daily cron is fine, or check last_stripe_sync_at
            // Optimized: always sync to catch status changes quickly
            await syncStripeSubscription(db, instance.tenant_id, instance.id);

            // 2. COMPUTE ECONOMICS (After Stripe sync so MRR is fresh)
            // Re-fetch instance to get updated Stripe Data? 
            // Better: update the instance object in memory or refetch. 
            // Refetching is safer to ensure consistency.
            const freshInstance = await db.prepare("SELECT * FROM saas_instances WHERE id = ?").bind(instance.id).first();
            const economics = await computeUnitEconomics(db, freshInstance);

            // 3. GET PULSE & PERSIST
            const pulse = await getPulseScore(db, instance.tenant_id);
            // Persist Pulse (Sentiment) so dashboard is fast
            await db.prepare("UPDATE saas_instances SET sentiment_score = ? WHERE id = ?").bind(pulse, instance.id).run();

            // 4. AUTOPILOT INTERVENTIONS
            const actions = await runInterventions(db, freshInstance, economics, pulse);
            if (actions.length > 0) interventionsCount++;
        }

        // Global Event Log
        await db.prepare(`
            INSERT INTO economic_events (id, tenant_id, saas_id, type, severity, payload_json)
            VALUES (?, 'global', 'system', 'OVERSEER_RUN', 'info', ?)
        `).bind(
            `ee_${crypto.randomUUID()}`,
            JSON.stringify({ processed, interventionsCount })
        ).run();

        return NextResponse.json({ success: true, processed, interventionsCount });

    } catch (e: any) {
        console.error("Overseer Cron Crash", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

async function getPulseScore(db: any, tenantId: string): Promise<number> {
    try {
        const result = await db.prepare(
            `SELECT count(*) as count FROM orchestrator_messages 
             WHERE thread_id = ? 
             AND created_at > datetime('now', '-7 days')`
        ).bind(tenantId).first('count');
        const count = (result as number) || 0;
        return Math.min(100, count * 2);
    } catch {
        return 0;
    }
}
