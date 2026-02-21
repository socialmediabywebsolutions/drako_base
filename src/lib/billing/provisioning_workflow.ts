
import { run, queryOne, queryAll } from "@/lib/db";
import { createTenant, createTenantUser } from "@/lib/tenants/services";

export type ProvisioningEvent = {
    eventId: string;
    type: "checkout.session.completed" | "invoice.payment_failed" | "invoice.payment_succeeded" | "customer.subscription.deleted" | "customer.subscription.updated" | "customer.subscription.created";
    data: {
        stripeCustomerId: string;
        stripeSubscriptionId: string;
        stripePriceId?: string;
        customerEmail: string;
        saasSlug: string;
        tenantId?: string; // Standardized from metadata
        planCode?: string; // Standardized from metadata
        tenantName?: string;
        currentPeriodStart?: string;
        currentPeriodEnd?: string;
        cancelAtPeriodEnd?: boolean;
    };
};

export type ProvisioningResult = {
    success: boolean;
    tenantId?: string;
    error?: string;
};

/**
 * Idempotent provisioning workflow triggered by Cloudflare Queue (Stripe Events).
 */
export async function provisionTenantFromStripe(event: ProvisioningEvent): Promise<ProvisioningResult> {
    const { stripeCustomerId, stripeSubscriptionId, stripePriceId, customerEmail, saasSlug, tenantName } = event.data;
    const correlationId = event.eventId;

    console.log(`[Provisioning] Starting for ${customerEmail} on ${saasSlug} (Price: ${stripePriceId})`);

    try {
        // 1. Identify Plan
        const plan = await queryOne<{ plan_code: string; limits_json: string; departments_json: string }>(
            `SELECT plan_code, limits_json, departments_json FROM saas_pricing_plans WHERE saas_slug = ? AND (stripe_price_id = ? OR stripe_product_id = ?)`,
            saasSlug, stripePriceId, stripePriceId
        );

        // Fallback strategy omitted for brevity but recommended in prod
        if (!plan) {
            const planByCode = await queryOne<{ plan_code: string; limits_json: string; departments_json: string }>(
                `SELECT plan_code, limits_json, departments_json FROM saas_pricing_plans WHERE saas_slug = ? AND plan_code = ?`,
                saasSlug, stripePriceId
            );
            if (!planByCode) throw new Error(`Plan not found for price ${stripePriceId} on ${saasSlug}`);
            Object.assign(plan!, planByCode);
        }

        const { plan_code, limits_json, departments_json } = plan!;
        const limits = JSON.parse(limits_json);
        const departments = JSON.parse(departments_json);

        // 2. Create Tenant (Idempotent)
        const existingSub = await queryOne<{ tenant_id: string }>(
            `SELECT tenant_id FROM saas_subscriptions WHERE stripe_subscription_id = ?`,
            stripeSubscriptionId
        );

        // Priority: 1. Existing Sub (Source of Truth) -> 2. Metadata (Trusted) -> 3. New (Auto-generated)
        let tenantId = existingSub?.tenant_id || event.data.tenantId;

        if (!tenantId) {
            const slug = tenantName?.toLowerCase().replace(/\s+/g, '-') ??
                customerEmail.split('@')[0] + '-' + Math.random().toString(36).substring(2, 7);

            tenantId = await createTenant({
                name: tenantName ?? customerEmail.split('@')[0],
                slug: slug,
                plan: plan_code
            });

            await createTenantUser({
                tenantId,
                email: customerEmail,
                role: 'owner'
            });
            console.log(`[Provisioning] Created tenant ${tenantId}`);
        }

        // 3. Subscription (Source of Truth)
        const periodStart = event.data.currentPeriodStart || new Date().toISOString();
        const periodEnd = event.data.currentPeriodEnd || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        const cancelAtEnd = event.data.cancelAtPeriodEnd ? 1 : 0;

        await run(
            `INSERT INTO saas_subscriptions (id, tenant_id, saas_slug, plan_code, stripe_customer_id, stripe_subscription_id, status, current_period_start, current_period_end, cancel_at_period_end, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
         ON CONFLICT(tenant_id, saas_slug) DO UPDATE SET
            status = 'active',
            plan_code = excluded.plan_code,
            stripe_subscription_id = excluded.stripe_subscription_id,
            current_period_start = excluded.current_period_start,
            current_period_end = excluded.current_period_end,
            cancel_at_period_end = excluded.cancel_at_period_end,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`,
            `sub_${stripeSubscriptionId}`,
            tenantId,
            saasSlug,
            plan_code,
            stripeCustomerId,
            stripeSubscriptionId,
            periodStart,
            periodEnd,
            cancelAtEnd
        );

        // 4. Initialize Quotas
        for (const key of Object.keys(limits)) {
            await run(
                `INSERT INTO saas_usage_quotas (id, tenant_id, saas_slug, quota_key, limit_value, period_start, period_end, reset_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now', '+1 month'))
             ON CONFLICT(tenant_id, saas_slug, quota_key) DO UPDATE SET
                limit_value = excluded.limit_value,
                period_end = excluded.period_end`,
                `quota_${tenantId}_${key}`,
                tenantId,
                saasSlug,
                key,
                limits[key],
                new Date().toISOString(),
                new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
            );
        }

        // 5. Initialize Departments (Based on Plan)
        // departments is an array of slugs or names
        if (Array.isArray(departments)) {
            for (const deptSlug of departments) {
                if (deptSlug === '*') continue; // Handle all
                const dId = `dept_${tenantId}_${deptSlug}`;
                await run(
                    `INSERT INTO tenant_departments (id, tenant_id, name, slug, is_active)
                     VALUES (?, ?, ?, ?, 1) ON CONFLICT(id) DO NOTHING`,
                    dId, tenantId, deptSlug.charAt(0).toUpperCase() + deptSlug.slice(1), deptSlug
                );
            }
        }

        // 6. Log Event
        await run(
            `INSERT INTO billing_audit_logs (id, saas_slug, tenant_id, event_type, metadata_json, correlation_id)
         VALUES (?, ?, ?, 'provisioning_success', ?, ?)`,
            `audit_${correlationId}`,
            saasSlug,
            tenantId,
            JSON.stringify({ plan: plan_code, priceId: stripePriceId }),
            correlationId
        );

        return { success: true, tenantId };

    } catch (error) {
        console.error(`[Provisioning] Failed:`, error);
        await run(
            `INSERT INTO billing_audit_logs (id, saas_slug, tenant_id, event_type, metadata_json, correlation_id)
         VALUES (?, ?, ?, 'provisioning_failed', ?, ?)`,
            `audit_err_${correlationId}`,
            saasSlug,
            'unknown',
            JSON.stringify({ error: (error as Error).message }),
            correlationId
        );
        return { success: false, error: (error as Error).message };
    }
}
