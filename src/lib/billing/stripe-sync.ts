import Stripe from 'stripe';
import { env } from '@/lib/cf';
import { STRIPE_PRICE_MAP, type PackName } from '@/lib/subscriptions';
import { crypto } from '@/lib/crypto-polyfill'; // Ensure we have crypto for IDs if needed

// Initialize Stripe (Node.js Runtime Only)
export const getStripe = () => {
    const key = process.env.STRIPE_SECRET_KEY || env()?.STRIPE_SECRET_KEY;
    if (!key) throw new Error("Missing STRIPE_SECRET_KEY");
    return new Stripe(key, { apiVersion: '2025-01-27.acacia' });
};

function resolvePackFromPrice(priceId: string): PackName | 'Custom' {
    const entry = Object.entries(STRIPE_PRICE_MAP).find(([_, id]) => id === priceId);
    return entry ? (entry[0] as PackName) : 'Custom';
}

export async function syncStripeSubscription(db: any, tenantId: string, saasId: string) {
    const startTime = Date.now();
    try {
        // 1. Get Subscription ID from DB (Source of Truth for Link)
        const subRecord = await db.prepare(`
            SELECT stripe_subscription_id, stripe_customer_id 
            FROM saas_subscriptions 
            WHERE tenant_id = ? AND status IN ('active', 'past_due', 'trialing')
            ORDER BY created_at DESC LIMIT 1
        `).bind(tenantId).first();

        if (!subRecord || !subRecord.stripe_subscription_id) {
            // Case: No Stripe sub found (Pure Trial or Manual)
            // Log info but don't fail
            await logEconomicEvent(db, tenantId, saasId, 'STRIPE_SYNC', 'info', { message: 'No active subscription record found locally.' });
            return;
        }

        const stripe = getStripe();
        const sub = await stripe.subscriptions.retrieve(subRecord.stripe_subscription_id);

        // 2. Extract Data
        const priceItem = sub.items.data[0].price;
        const currentPack = resolvePackFromPrice(priceItem.id);
        const amount = (priceItem.unit_amount || 0) / 100; // Cents to Unit
        const currency = priceItem.currency.toUpperCase();

        // Convert to EUR provided logic (Assuming simple 1:1 if USD for now or exact if EUR)
        // User said: "Moneda real: usa EUR y saca el MRR del amount del Price en Stripe"
        // If Stripe returns USD, we assume 1:1 for simplicity unless configured otherwise.
        const mrrEur = amount;
        const arrEur = mrrEur * 12;

        // 3. Update saas_instances
        await db.prepare(`
            UPDATE saas_instances SET
                stripe_customer_id = ?,
                stripe_subscription_id = ?,
                current_pack = ?,
                mrr_eur = ?,
                arr_eur = ?,
                last_stripe_sync_at = ?
            WHERE id = ?
        `).bind(
            sub.customer as string,
            sub.id,
            currentPack,
            mrrEur,
            arrEur,
            new Date().toISOString(),
            saasId
        ).run();

        // 4. Log Success
        await logEconomicEvent(db, tenantId, saasId, 'STRIPE_SYNC', 'info', {
            pack: currentPack,
            mrr: mrrEur,
            status: sub.status,
            duration_ms: Date.now() - startTime
        });

    } catch (e: any) {
        console.error("Stripe Sync Failed", e);
        // Fail Safe: Don't throw, just log warning
        await logEconomicEvent(db, tenantId, saasId, 'STRIPE_SYNC', 'warn', {
            error: e.message,
            stack: e.stack
        });
    }
}

async function logEconomicEvent(db: any, tenantId: string, saasId: string, type: string, severity: string, payload: any) {
    const id = `ee_${crypto.randomUUID()}`;
    await db.prepare(`
        INSERT INTO economic_events (id, tenant_id, saas_id, type, severity, payload_json)
        VALUES (?, ?, ?, ?, ?, ?)
    `).bind(id, tenantId, saasId, type, severity, JSON.stringify(payload)).run();
}
