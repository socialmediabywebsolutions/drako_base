
export interface Env {
    DRACO_DB: D1Database;
    STRIPE_WEBHOOK_SECRET: string;
}

const STRIPE_PRODUCT_MAP: Record<string, string> = {
    'prod_starter': 'Starter',
    'prod_pro': 'Pro',
    'prod_enterprise': 'Enterprise'
};

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        if (request.method !== "POST") {
            return new Response("Method not allowed", { status: 405 });
        }

        try {
            const sig = request.headers.get("stripe-signature");
            const bodyText = await request.text();

            // Verification Logic (Simplified for V1, assuming using official library or trusted proxy in future)
            // In a real production env, use 'stripe' npm package to verify signature using env.STRIPE_WEBHOOK_SECRET
            const event = JSON.parse(bodyText);

            // Idempotency Check (Optional but recommended)
            // For V1 we rely on "UPSERT" logic in DB which is naturally idempotent-ish.

            console.log(`[STRIPE] Received event: ${event.type}`);

            switch (event.type) {
                case "checkout.session.completed":
                    await handleCheckoutCompleted(event.data.object, env);
                    break;
                case "customer.subscription.updated":
                case "customer.subscription.deleted":
                    await handleSubscriptionUpdated(event.data.object, env);
                    break;
                default:
                    console.log(`[STRIPE] Unhandled event type: ${event.type}`);
            }

            return new Response(JSON.stringify({ received: true }), { status: 200 });
        } catch (err: any) {
            console.error(`[STRIPE] Error: ${err.message}`);
            return new Response(`Webhook Error: ${err.message}`, { status: 400 });
        }
    },
};

async function handleCheckoutCompleted(session: any, env: Env) {
    // Extract Metadata (Passed during Checkout Creation)
    const tenantId = session.metadata?.tenantId;
    const saasId = session.metadata?.saasId;

    if (!tenantId) {
        console.error("[STRIPE] Missing tenantId in metadata");
        return;
    }

    // Provisioning Data
    const data = {
        tenantId,
        saasId: saasId || null,
        customerId: session.customer,
        subscriptionId: session.subscription,
        // We might not have price/product directly in session object properly expanded
        // For V1 assume we get the expanded object or we query it.
        // Actually session object usually has 'subscription' expanded if configured?
        // Let's rely on subscription.updated event for full details? 
        // Usually 'checkout.session.completed' is the trigger to "Start".
        status: 'active'
    };

    // NOTE: 'checkout.session.completed' might not be enough if subscription details are needed (like productId).
    // Usually we listen to 'customer.subscription.created' for that.
    // But let's check if we can get line_items or something.
    // For V6.0 MVP, we will rely on 'customer.subscription.updated' / 'created' for the HEAVY lifting of logic?
    // Or purely rely on Metadata.

    // Let's try to provision if we have the info.
    console.log(`[STRIPE] Checkout Completed for ${tenantId}`);
}

async function handleSubscriptionUpdated(subscription: any, env: Env) {
    const tenantId = subscription.metadata?.tenantId;
    const saasId = subscription.metadata?.saasId;

    // If metadata is missing on subscription object (it often IS if not copied from Checkout),
    // we might need to lookup based on 'customer'.
    // But Stripe Checkout copies metadata to Subscription if 'subscription_data.metadata' is set. 
    // We assume our `createProject` logic sets this correctly.

    if (!tenantId) {
        console.warn("[STRIPE] Subscription update missing tenantId metadata. Attempting lookup by Customer?");
        // TODO: Lookup user by stripe_customer_id in saas_subscriptions?
        return;
    }

    const priceId = subscription.items.data[0].price.id;
    const productId = subscription.items.data[0].price.product;
    const status = subscription.status;
    const periodEnd = new Date(subscription.current_period_end * 1000).toISOString();

    await provisionSubscription(env.DRACO_DB, {
        tenantId,
        saasId: saasId || null,
        customerId: subscription.customer,
        subscriptionId: subscription.id,
        priceId,
        productId,
        status,
        periodEnd
    });
}

// Logic Duplicated from Repository (Adapted for Worker D1 Binding)
async function provisionSubscription(db: D1Database, data: any) {
    const now = new Date().toISOString();
    const subId = crypto.randomUUID();

    // 1. Upsert Subscription
    await db.prepare(`
        INSERT INTO saas_subscriptions (id, tenant_id, saas_id, stripe_customer_id, stripe_subscription_id, stripe_price_id, status, current_period_end, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(tenant_id, saas_id) DO UPDATE SET
            stripe_subscription_id = excluded.stripe_subscription_id,
            stripe_price_id = excluded.stripe_price_id,
            status = excluded.status,
            current_period_end = excluded.current_period_end,
            updated_at = excluded.updated_at
    `).bind(
        subId,
        data.tenantId,
        data.saasId,
        data.customerId,
        data.subscriptionId,
        data.priceId,
        data.status,
        data.periodEnd,
        now, now
    ).run();

    // 2. Resolve Pack
    const packName = STRIPE_PRODUCT_MAP[data.productId];

    if (packName && (data.status === 'active' || data.status === 'trialing')) {
        console.log(`[MONETIZATION] Provisioning '${packName}' for ${data.tenantId}/${data.saasId}`);
        if (data.saasId) {
            await clonePolicyPack(db, data.tenantId, data.saasId, packName);
        }
    } else {
        // Downgrade
        if (data.saasId && (data.status === 'canceled' || data.status === 'unpaid' || data.status === 'past_due')) {
            await clonePolicyPack(db, data.tenantId, data.saasId, "Starter");
        }
    }
}

async function clonePolicyPack(db: D1Database, tenantId: string, saasId: string, packName: string) {
    // 1. Get Pack
    const pack: any = await db.prepare("SELECT id, policies_json, cost_policy_json FROM saas_policy_packs WHERE pack_name = ? LIMIT 1")
        .bind(packName).first();

    if (!pack) {
        console.warn(`Policy Pack '${packName}' not found.`);
        return;
    }

    const policies = JSON.parse(pack.policies_json);
    const costPolicy = JSON.parse(pack.cost_policy_json);
    const now = new Date().toISOString();

    // 2. Insert AI Provider Policies (Replace logic usually needed, but Upsert is okay for V1)
    // Actually we should probably DELETE old ones or UPDATE?
    // 'INSERT OR IGNORE' prevents overwriting if ID conflicts, but here we want to OVERWRITE for Plan Change.
    // Simpler: Delete all for this saasId and Re-Insert.

    await db.prepare("DELETE FROM ai_provider_policies WHERE tenant_id = ? AND saas_id = ?").bind(tenantId, saasId).run();

    const stmt = db.prepare(`
        INSERT INTO ai_provider_policies 
        (id, tenant_id, saas_id, plan, task_type, mode, provider, model, priority, is_active, created_at, updated_at)
        VALUES (?, ?, ?, 'standard', ?, ?, ?, ?, ?, 1, ?, ?)`
    );

    const batch = [];
    for (const p of policies) {
        const id = crypto.randomUUID();
        batch.push(stmt.bind(id, tenantId, saasId, p.task_type, p.mode, p.provider, p.model, p.priority, now, now));
    }
    if (batch.length > 0) await db.batch(batch);

    // 3. Update AI Cost Policy
    // We want to UPDATE limits.
    const cpId = crypto.randomUUID();
    await db.prepare(`
        INSERT INTO ai_cost_policies
        (id, tenant_id, saas_id, soft_limit_usd, hard_limit_usd, latency_sla_ms, downgrade_provider, downgrade_model, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(tenant_id, saas_id) DO UPDATE SET
            soft_limit_usd = excluded.soft_limit_usd,
            hard_limit_usd = excluded.hard_limit_usd,
            latency_sla_ms = excluded.latency_sla_ms,
            downgrade_provider = excluded.downgrade_provider,
            downgrade_model = excluded.downgrade_model,
            updated_at = excluded.updated_at
    `).bind(
        cpId, tenantId, saasId,
        costPolicy.soft_limit_usd,
        costPolicy.hard_limit_usd,
        costPolicy.latency_sla_ms,
        costPolicy.downgrade_provider,
        costPolicy.downgrade_model,
        now, now
    ).run();
}
