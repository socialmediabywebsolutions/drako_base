'use server';

import { env } from '@/lib/cf';
import { revalidatePath } from 'next/cache';

interface GovernanceAction {
    tenantId: string;
    slug: string;
    action: 'FREEZE' | 'BONUS' | 'UPGRADE' | 'KILL' | 'FORCE_ACTIVE' | 'ARCHIVE';
    reason: string;
}

export async function executeGovernanceAction({ tenantId, slug, action, reason }: GovernanceAction) {
    const bindings = env();
    if (!bindings?.DRACO_DB) return { error: "DB Connect Failed" };

    const db = bindings.DRACO_DB;
    const interventionId = crypto.randomUUID();

    try {
        let sql = '';
        let eventType = '';
        let details = {};

        switch (action) {
            case 'FREEZE':
                // Set degraded mode and add flag
                sql = `UPDATE saas_instances SET lifecycle_status = 'paused', paused_at = datetime('now'), intervention_flags = IFNULL(intervention_flags, '') || ',MANUAL_FREEZE' WHERE tenant_id = ?`;
                eventType = 'GOV_FREEZE';
                details = { degraded_mode: 1, flag: 'MANUAL_FREEZE' };
                break;

            case 'BONUS':
                // In a real system, this would add credits. For v1, we just log it as a positive intervention.
                sql = `UPDATE saas_instances SET degraded_mode = 0, risk_level = 'low' WHERE tenant_id = ?`;
                eventType = 'GOV_INJECTION';
                details = { credits_added: 500 };
                break;

            case 'UPGRADE':
                // Force plan to Pro
                sql = `UPDATE saas_instances SET current_pack = 'Pro', status = 'active' WHERE tenant_id = ?`;
                eventType = 'GOV_UPGRADE';
                details = { new_pack: 'Pro', status: 'active' };
                break;

            case 'KILL':
                sql = `UPDATE saas_instances SET status = 'suspended', lifecycle_status = 'archived', archived_at = datetime('now') WHERE tenant_id = ?`;
                eventType = 'GOV_KILL';
                details = { status: 'suspended' };
                break;

            case 'FORCE_ACTIVE':
                sql = `UPDATE saas_instances SET lifecycle_status = 'active', paused_at = NULL, past_due_since = NULL, intervention_flags = REPLACE(IFNULL(intervention_flags, ''), 'MANUAL_FREEZE', '') WHERE tenant_id = ?`;
                eventType = 'GOV_FORCE_ACTIVE';
                details = { status: 'active', reason: 'CEO Override' };
                break;

            case 'ARCHIVE':
                sql = `UPDATE saas_instances SET lifecycle_status = 'archived', archived_at = datetime('now') WHERE tenant_id = ?`;
                eventType = 'GOV_ARCHIVE';
                details = { status: 'archived' };
                break;
        }

        if (!sql) return { error: "Invalid Action" };

        // 1. Execute Update
        await db.prepare(sql).bind(tenantId).run();

        // 2. Log Economic Event (Audit)
        await db.prepare(
            `INSERT INTO economic_events (id, tenant_id, saas_id, type, severity, payload_json) 
             VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(
            crypto.randomUUID(), tenantId, slug, eventType, 'critical',
            JSON.stringify({ action, reason, details, by: 'CEO_OVERRIDE' })
        ).run();

        // 3. Log Intervention Action
        await db.prepare(
            `INSERT INTO intervention_actions (id, tenant_id, saas_id, action, reason, status, details_json)
              VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            interventionId, tenantId, slug, action, reason, 'applied', JSON.stringify(details)
        ).run();

        revalidatePath('/site/panel/hq');
        return { success: true, interventionId };

    } catch (err: any) {
        console.error("Governance Error:", err);
        return { error: err.message };
    }
}
