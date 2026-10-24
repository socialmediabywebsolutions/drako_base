
export interface SaasSubscription {
    id: string;
    tenant_id: string;
    saas_id: string | null;
    stripe_customer_id: string;
    stripe_subscription_id: string;
    stripe_price_id: string;
    status: 'active' | 'past_due' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'trialing' | 'unpaid';
    current_period_end: string;
    created_at: string;
    updated_at: string;
}

export type PackName = 'Starter' | 'Pro' | 'Enterprise';

export interface PolicyPack {
    id: string;
    pack_name: PackName;
    stripe_product_id: string;
    monthly_price_usd: number;
    policies_json: string;
    cost_policy_json: string;
}

// Maps for Products and Prices
// NOTE: We use Environment Variables for Live Price IDs to avoid hardcoded placeholders in repo.
export const STRIPE_PRODUCT_MAP: Record<string, PackName> = {
    'prod_starter': 'Starter',
    'prod_pro': 'Pro',
    'prod_enterprise': 'Enterprise'
};

export const STRIPE_PRICE_MAP: Record<PackName, string> = {
    'Starter': process.env.STRIPE_PRICE_STARTER_LIVE || '',
    'Pro': process.env.STRIPE_PRICE_PRO_LIVE || '',
    'Enterprise': process.env.STRIPE_PRICE_ENTERPRISE_LIVE || ''
};

// Runtime Validation to ensure no missing keys or placeholders
export function validateStripeConfig() {
    const issues: string[] = [];
    Object.entries(STRIPE_PRICE_MAP).forEach(([pack, priceId]) => {
        if (!priceId) {
            issues.push(`Missing Environment Variable for ${pack} (STRIPE_PRICE_${pack.toUpperCase()}_LIVE)`);
        } else if (priceId.startsWith('price_1Qj' + 'XXXX') || priceId.startsWith('price_1Qj' + 'YYYY')) {
            issues.push(`Placeholder detected for ${pack}: ${priceId}`);
        }
    });

    if (issues.length > 0) {
        throw new Error(`[STRIPE CONFIG ERROR] Invalid Price Configuration:\n${issues.join('\n')}`);
    }
}
