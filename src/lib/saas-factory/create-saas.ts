
import { queryOne, run } from "@/lib/db";
import { z } from "zod";
import Stripe from "stripe";
import { env as resolveEnv } from "@/lib/cf";

// --- Types & Validation ---

export const SaasPlanSchema = z.object({
    planCode: z.enum(["starter", "pro", "scale"]),
    monthlyPriceCents: z.number().int().min(0),
    currency: z.string().default("eur"),
    limitsJson: z.record(z.string(), z.any()), // flexible for now
    departmentsJson: z.array(z.string()), // e.g. ["default", "sales"]
});

export const CreateSaasInputSchema = z.object({
    saasSlug: z.string().min(2).max(40).regex(/^[a-z0-9-]+$/),
    name: z.string().min(2).max(80),
    plans: z.array(SaasPlanSchema).refine((plans) => {
        const codes = plans.map((p) => p.planCode);
        return codes.includes("starter") && codes.includes("pro") && codes.includes("scale");
    }, "Must include starter, pro, and scale plans"),
    dryRun: z.boolean().default(false),
});

export type CreateSaasInput = z.infer<typeof CreateSaasInputSchema>;

export type SaasFactoryJobMessage = {
    correlationId: string;
    saasSlug: string;
    name: string;
    plans: Array<{
        planCode: "starter" | "pro" | "scale";
        monthlyPriceCents: number;
        currency: string;
        limitsJson: Record<string, any>;
        departmentsJson: string[];
    }>;
    dryRun: boolean;
    requestedByUserId?: string;
    origin: "campamento_base";
};

// --- Core Logic ---

export function validateSaasFactoryInput(input: unknown): CreateSaasInput {
    return CreateSaasInputSchema.parse(input);
}

export async function createSaasRegistryEntry(params: {
    saasSlug: string;
    name: string;
    correlationId: string;
}): Promise<void> {
    // Fail-closed: check existence first (handled by unique constraint usually, but let's be explicit)
    const existing = await queryOne<{ saas_slug: string }>(
        "SELECT saas_slug FROM holding_saas_registry WHERE saas_slug = ?",
        params.saasSlug
    );

    if (existing) {
        // If it exists, we warn but don't fail hard if it's the same name? 
        // Prompt says: "Rechazar si saasSlug ya existe y overwriteIfExists=false" (API layer)
        // The worker should be idempotent. If it exists, we skip insert.
        console.warn(`[${params.correlationId}] SaaS ${params.saasSlug} already in registry.`);
        return;
    }

    await run(
        `INSERT INTO holding_saas_registry (saas_slug, display_name, status, created_at)
     VALUES (?, ?, 'active', strftime('%Y-%m-%dT%H:%M:%fZ','now'))`,
        params.saasSlug,
        params.name
    );
}

export async function createStripeProductAndPrices(params: {
    saasSlug: string;
    name: string;
    plans: CreateSaasInput["plans"];
    correlationId: string;
}): Promise<{ productId: string; priceIds: Record<string, string> }> {
    const env = resolveEnv();
    const apiKey = env?.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
    if (!apiKey) throw new Error("STRIPE_SECRET_KEY missing");

    const stripe = new Stripe(apiKey, {}); // Use SDK default version

    // 1. Create Product
    // Idempotency: search by metadata
    let productId: string | null = null;
    const search = await stripe.products.search({
        query: `metadata['saas_slug']:'${params.saasSlug}' AND metadata['origin']:'campamento_base'`,
        limit: 1,
    });

    if (search.data.length > 0) {
        productId = search.data[0].id;
        console.log(`[${params.correlationId}] Found existing Stripe product ${productId}`);
    } else {
        const product = await stripe.products.create({
            name: params.name,
            metadata: {
                saas_slug: params.saasSlug,
                origin: "campamento_base",
            },
        });
        productId = product.id;
        console.log(`[${params.correlationId}] Created Stripe product ${productId}`);
    }

    // 2. Create Prices
    const priceIds: Record<string, string> = {};

    for (const plan of params.plans) {
        // Idempotency: search prices? Stripe prices are immutable.
        // We look up by lookup_key if we used it, or we rely on creating new ones if strictly needed.
        // The prompt says "Crear 3 Prices". Let's try to lookup first to avoid dupes on retries.
        // Actually, searching prices by metadata is tricky.
        // Let's create them. If we store them in DB, we know their IDs. 
        // If we crash before DB insert, we might create dupes. 
        // Better to modify the price creation to use `lookup_key` if we want strict idempotency, 
        // or just accept re-creation (since they are just prices).
        // Prompt says: "metadata obligatoria: saas_slug, plan_code, origin".

        // We can list prices for the product and filter by metadata in memory
        const existingPrices = await stripe.prices.list({
            product: productId,
            active: true,
            limit: 100,
        });

        const match = existingPrices.data.find(
            (p) =>
                p.metadata.saas_slug === params.saasSlug &&
                p.metadata.plan_code === plan.planCode &&
                p.unit_amount === plan.monthlyPriceCents &&
                p.currency.toLowerCase() === plan.currency.toLowerCase()
        );

        if (match) {
            priceIds[plan.planCode] = match.id;
        } else {
            const price = await stripe.prices.create({
                product: productId,
                currency: plan.currency,
                unit_amount: plan.monthlyPriceCents,
                recurring: { interval: "month" },
                metadata: {
                    saas_slug: params.saasSlug,
                    plan_code: plan.planCode,
                    origin: "campamento_base",
                },
            });
            priceIds[plan.planCode] = price.id;
        }
    }

    return { productId, priceIds };
}

export async function persistPricingPlans(params: {
    saasSlug: string;
    plans: CreateSaasInput["plans"];
    stripeProductId?: string;
    stripePriceIds?: Record<string, string>; // Optional for dry-run
    correlationId: string;
}): Promise<void> {
    for (const plan of params.plans) {
        const stripePriceId = params.stripePriceIds?.[plan.planCode] || null;

        // Upsert logic
        await run(
            `INSERT INTO saas_pricing_plans (
        id, saas_slug, plan_code, stripe_product_id, stripe_price_id, 
        monthly_price_cents, departments_json, limits_json, is_active, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
       ON CONFLICT(saas_slug, plan_code) DO UPDATE SET
        stripe_product_id = excluded.stripe_product_id,
        stripe_price_id = excluded.stripe_price_id,
        monthly_price_cents = excluded.monthly_price_cents,
        departments_json = excluded.departments_json,
        limits_json = excluded.limits_json
      `,
            `${params.saasSlug}_${plan.planCode}`, // ID convention
            params.saasSlug,
            plan.planCode,
            params.stripeProductId || null,
            stripePriceId,
            plan.monthlyPriceCents,
            JSON.stringify(plan.departmentsJson),
            JSON.stringify(plan.limitsJson)
        );
    }
}

export async function runSaasFactoryJob(message: SaasFactoryJobMessage): Promise<{ success: boolean; error?: string }> {
    const { correlationId, saasSlug, name, plans, dryRun } = message;

    try {
        console.log(`[${correlationId}] Starting SaaS Factory Job for ${saasSlug} (dryRun=${dryRun})`);

        // 1. Create/Ensure Registry Entry
        // In dry-run we might simulate or just skip if we want strictly NO DB changes.
        // Prompt says: "Si dryRun=true: NO modificar DB de forma permanente (o escribir en tablas temporales / audit only)"
        // BUT Verify E2E says: "Confirmar que NO existe en registry ni en plans"
        // So in dry-run we SKIP registry insert.

        if (!dryRun) {
            await createSaasRegistryEntry({ saasSlug, name, correlationId });
        }

        // 2. Stripe
        let stripeResult: { productId: string; priceIds: Record<string, string> } | null = null;
        if (!dryRun) {
            try {
                stripeResult = await createStripeProductAndPrices({ saasSlug, name, plans, correlationId });
            } catch (e: any) {
                console.error(`[${correlationId}] Stripe failed:`, e);
                // Rollback: Disable registry entry
                await run(`UPDATE holding_saas_registry SET status = 'disabled' WHERE saas_slug = ?`, saasSlug);

                await run(
                    `INSERT INTO billing_audit_logs (id, saas_slug, event_type, severity, correlation_id, metadata_json)
             VALUES (?, ?, ?, ?, ?, ?)`,
                    `err_${correlationId}`, saasSlug, "saas_factory.failed", "CRITICAL", correlationId,
                    JSON.stringify({ error: e.message, stage: "stripe_creation" })
                );
                throw e; // Re-throw to trigger worker retry? Or return failure?
                // Prompt says "Rollback mínimo... Audit critical".
                return { success: false, error: e.message };
            }
        }

        // 3. Persist Plans
        // In dry-run, prompt says "Insertar planes con stripe_price_id = null"??
        // Wait, prompt says: "Si dryRun=true: ... NO modificar DB de forma permanente ... Devolver audit indicando lo que HARÍA"
        // AND "Verify E2E: Confirmar que NO existe en registry ni en plans"
        // So we definitely do NOT insert into plans in dry-run properly. 
        // But maybe for verifying logic we just log it.

        if (!dryRun) {
            await persistPricingPlans({
                saasSlug,
                plans,
                stripeProductId: stripeResult?.productId,
                stripePriceIds: stripeResult?.priceIds,
                correlationId
            });
        }

        // 4. Audit
        const auditPayload = {
            dryRun,
            plansCount: plans.length,
            stripeProductId: stripeResult?.productId,
            stripePriceIds: stripeResult?.priceIds,
        };

        await run(
            `INSERT INTO billing_audit_logs (id, saas_slug, event_type, severity, correlation_id, metadata_json)
         VALUES (?, ?, ?, ?, ?, ?)`,
            `audit_${correlationId}`, saasSlug, "saas_factory.completed", "INFO", correlationId,
            JSON.stringify(auditPayload)
        );

        console.log(`[${correlationId}] Job completed successfully.`);
        return { success: true };

    } catch (error: any) {
        console.error(`[${correlationId}] Job failed unrecoverably:`, error);
        return { success: false, error: error.message };
    }
}
