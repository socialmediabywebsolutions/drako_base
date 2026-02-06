import { crypto } from '@/lib/crypto-polyfill';

export async function runInterventions(db: any, instance: any, economics: any, pulse: number) {
    const actionsTaken: string[] = [];

    // 1. RULE A (CRITICAL): Negative Margin + Late Trial -> Degrade
    if (economics.marginEur < 0 && economics.daysInTrial > 20) {
        if (!await isActionApplied(db, instance.id, 'DEGRADE')) {
            await applyIntervention(db, instance, 'DEGRADE', 'NEGATIVE_MARGIN_LATE_TRIAL', {
                margin: economics.marginEur,
                days: economics.daysInTrial
            });
            // Apply Flag to Instance
            await addInterventionFlag(db, instance, 'degraded_mode');
            // Set DB Column
            await db.prepare("UPDATE saas_instances SET degraded_mode = 1 WHERE id = ?").bind(instance.id).run();
            actionsTaken.push('DEGRADE');
        }
    }

    // 2. RULE B (BILLING): Bad Stripe Status -> Freeze
    // Statuses: 'past_due', 'unpaid', 'canceled'
    // saas_subscriptions status is strict.
    // We check instance.stripe_subscription_id to verify we have a link.
    if (instance.stripe_subscription_id) {
        // Fetch sub status from DB (it was just synced by stripe-sync)
        const subStatus = await db.prepare("SELECT status FROM saas_subscriptions WHERE stripe_subscription_id = ?").bind(instance.stripe_subscription_id).first('status');

        if (['past_due', 'unpaid', 'canceled'].includes(subStatus as string)) {
            if (!await isActionApplied(db, instance.id, 'FREEZE_EXPANSION')) {
                await applyIntervention(db, instance, 'FREEZE_EXPANSION', `BILLING_STATUS_${subStatus}`, { status: subStatus });
                await addInterventionFlag(db, instance, 'billing_risk');
                actionsTaken.push('FREEZE_EXPANSION');
            }
        }
    }

    // 3. RULE C (LOW PULSE): Low Engagement -> Nudge
    if (pulse < 20 && instance.plan_tier === 'trial' && economics.daysInTrial > 7) {
        // Just a log action, no hard block
        if (!await isActionApplied(db, instance.id, 'SUGGEST_UPGRADE')) {
            await applyIntervention(db, instance, 'SUGGEST_UPGRADE', 'LOW_PULSE_ENGAGEMENT', { pulse });
            actionsTaken.push('SUGGEST_UPGRADE');
        }
    }

    return actionsTaken;
}

async function isActionApplied(db: any, saasId: string, action: string): Promise<boolean> {
    const existing = await db.prepare(`
        SELECT id FROM intervention_actions 
        WHERE saas_id = ? AND action = ? AND status = 'applied'
    `).bind(saasId, action).first();
    return !!existing;
}

async function applyIntervention(db: any, instance: any, action: string, reason: string, details: any) {
    // Log Action
    await db.prepare(`
        INSERT INTO intervention_actions (id, tenant_id, saas_id, action, reason, status, details_json)
        VALUES (?, ?, ?, ?, ?, 'applied', ?)
    `).bind(
        `ia_${crypto.randomUUID()}`,
        instance.tenant_id,
        instance.id,
        action,
        reason,
        JSON.stringify(details)
    ).run();

    // Log Event
    await db.prepare(`
        INSERT INTO economic_events (id, tenant_id, saas_id, type, severity, payload_json)
        VALUES (?, ?, ?, 'INTERVENTION_APPLIED', 'warn', ?)
    `).bind(
        `ee_${crypto.randomUUID()}`,
        instance.tenant_id,
        instance.id,
        JSON.stringify({ action, reason, details })
    ).run();
}

async function addInterventionFlag(db: any, instance: any, flag: string) {
    const currentFlags = instance.intervention_flags ? JSON.parse(instance.intervention_flags) : [];
    if (!currentFlags.includes(flag)) {
        const newFlags = [...currentFlags, flag];
        await db.prepare("UPDATE saas_instances SET intervention_flags = ? WHERE id = ?")
            .bind(JSON.stringify(newFlags), instance.id).run();
    }
}
