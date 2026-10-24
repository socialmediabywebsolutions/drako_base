import { crypto } from '@/lib/crypto-polyfill';
import { getCanonicalBillingSnapshot } from '@/lib/billing/subscriptions';

const BILLING_RISK_STATUSES = new Set(["past_due", "unpaid", "canceled"]);

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
    // Resolve from the canonical tenant + saas slug subscription, and only
    // trust it when it matches the instance-linked Stripe subscription.
    if (instance.stripe_subscription_id) {
        const subStatus = await resolveCanonicalBillingStatus(instance);

        if (subStatus && BILLING_RISK_STATUSES.has(subStatus)) {
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

async function resolveCanonicalBillingStatus(instance: any): Promise<string | null> {
    const tenantId = instance.tenant_id?.trim();
    const saasSlug = instance.slug?.trim().toLowerCase();
    const stripeSubscriptionId = instance.stripe_subscription_id?.trim();
    if (!tenantId || !saasSlug || !stripeSubscriptionId) {
        return null;
    }

    const snapshot = await getCanonicalBillingSnapshot({ tenantId, saasSlug });
    const canonicalStripeSubscriptionId = snapshot.subscription.stripeSubscriptionId?.trim();
    const canonicalStatus = snapshot.subscription.status?.trim().toLowerCase() ?? null;

    if (!canonicalStripeSubscriptionId || canonicalStripeSubscriptionId !== stripeSubscriptionId) {
        return null;
    }

    return canonicalStatus;
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
