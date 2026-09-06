import Stripe from "stripe";
import { env } from "@/lib/cf";
import { getCanonicalBillingSnapshot } from "@/lib/billing/subscriptions";
import { STRIPE_PRICE_MAP, type PackName } from "@/lib/subscriptions";
import { crypto } from "@/lib/crypto-polyfill";

// Initialize Stripe (Node.js Runtime Only)
export const getStripe = () => {
    const key = process.env.STRIPE_SECRET_KEY || env()?.STRIPE_SECRET_KEY;
    if (!key) throw new Error("Missing STRIPE_SECRET_KEY");
    return new Stripe(key, { apiVersion: "2025-12-15.clover" });
};

function resolvePackFromPrice(priceId: string): PackName | "Custom" {
    const entry = Object.entries(STRIPE_PRICE_MAP).find(([_, id]) => id === priceId);
    return entry ? (entry[0] as PackName) : "Custom";
}

const SYNCABLE_SUBSCRIPTION_STATUSES = new Set(["active", "past_due", "trial", "trialing"]);

export async function syncStripeSubscription(db: any, tenantId: string, saasId: string) {
    const startTime = Date.now();
    try {
        const instance = await db.prepare(`
            SELECT id, tenant_id, slug
            FROM saas_instances
            WHERE id = ? AND tenant_id = ?
            LIMIT 1
        `).bind(saasId, tenantId).first() as { id: string; tenant_id: string; slug: string | null } | null;

        const saasSlug = instance?.slug?.trim().toLowerCase() ?? null;
        if (!saasSlug) {
            await logEconomicEvent(db, tenantId, saasId, "STRIPE_SYNC", "info", {
                message: "No canonical SaaS slug found for instance.",
            });
            return;
        }

        const snapshot = await getCanonicalBillingSnapshot({ tenantId, saasSlug });
        const canonicalStatus = snapshot.subscription.status?.trim().toLowerCase() ?? "";
        const stripeSubscriptionId = snapshot.subscription.stripeSubscriptionId;
        if (!stripeSubscriptionId || !SYNCABLE_SUBSCRIPTION_STATUSES.has(canonicalStatus)) {
            await logEconomicEvent(db, tenantId, saasId, "STRIPE_SYNC", "info", {
                message: "No syncable canonical subscription record found locally.",
                saasSlug,
                subscriptionStatus: canonicalStatus || null,
            });
            return;
        }

        const stripe = getStripe();
        const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);

        const priceItem = sub.items.data[0]?.price;
        if (!priceItem) {
            throw new Error("STRIPE_PRICE_MISSING");
        }
        const currentPack = resolvePackFromPrice(priceItem.id);
        const amount = (priceItem.unit_amount || 0) / 100;
        const currency = priceItem.currency.toUpperCase();

        const mrrEur = amount;
        const arrEur = mrrEur * 12;
        const stripeCustomerId =
            typeof sub.customer === "string"
                ? sub.customer
                : sub.customer?.id ?? snapshot.subscription.stripeCustomerId;

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
            stripeCustomerId,
            sub.id,
            currentPack,
            mrrEur,
            arrEur,
            new Date().toISOString(),
            saasId
        ).run();

        await logEconomicEvent(db, tenantId, saasId, "STRIPE_SYNC", "info", {
            saasSlug,
            pack: currentPack,
            mrr: mrrEur,
            status: sub.status,
            currency,
            duration_ms: Date.now() - startTime
        });

    } catch (e: any) {
        console.error("Stripe Sync Failed", e);
        await logEconomicEvent(db, tenantId, saasId, "STRIPE_SYNC", "warn", {
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
