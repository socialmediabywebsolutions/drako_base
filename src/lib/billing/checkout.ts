
import { Stripe } from "stripe";
import { env } from "@/lib/db";

/**
 * STANDARD CAMPAMENTO BASE CHECKOUT
 * Enforces metadata rules for all SaaS subsidiaries.
 */

import { queryOne } from "@/lib/db";

export async function createCheckoutSession(params: {
    tenantId: string;
    saasSlug: string;
    planCode: string;
    successUrl: string;
    cancelUrl: string;
    customerEmail?: string;
    quantity?: number;
}) {
    const e = env();
    if (!e?.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY missing");

    // 1. Validate SaaS in Registry
    const registry = await queryOne<{ saas_slug: string }>(
        `SELECT saas_slug FROM holding_saas_registry WHERE saas_slug = ? AND status = 'active'`,
        params.saasSlug
    );
    if (!registry) {
        throw new Error(`SaaS '${params.saasSlug}' is not registered or active.`);
    }

    // 2. Resolve Price ID from Plan
    const plan = await queryOne<{ stripe_price_id: string }>(
        `SELECT stripe_price_id FROM saas_pricing_plans WHERE saas_slug = ? AND plan_code = ?`,
        params.saasSlug, params.planCode
    );

    if (!plan || !plan.stripe_price_id) {
        throw new Error(`Plan '${params.planCode}' for '${params.saasSlug}' has no configured Stripe Price ID.`);
    }

    // 3. Create Session
    const stripe = new Stripe(e.STRIPE_SECRET_KEY, { apiVersion: "2024-12-18.acacia" as any });

    const metadata = {
        saas_slug: params.saasSlug,
        tenant_id: params.tenantId,
        plan_code: params.planCode,
        origin: "campamento_base",
        env: "production"
    };

    const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "subscription",
        customer_email: params.customerEmail,
        line_items: [
            {
                price: plan.stripe_price_id,
                quantity: params.quantity || 1,
            },
        ],
        subscription_data: {
            metadata: metadata,
        },
        metadata: metadata,
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        allow_promotion_codes: true,
    });

    return session;
}
