import { queryOne, queryAll, run } from "@/lib/db";
import { env } from "@/lib/cf";

export interface StripeTier {
    name: string;
    monthly: number;
    yearly: number;
    features: string[];
}

export interface StripeSetupTemplate {
    id: string;
    slug: string;
    name: string;
    vertical: string;
    suggestedMonthlyPrice: number;
    suggestedYearlyPrice: number;
    suggestedTiers: StripeTier[];
    defaultPacks: string[];
    defaultFeatures: string[];
    defaultLimits: Record<string, number>;
    description: string;
}

export interface StripeSetupConfig {
    saasId: string;
    saasName: string;
    templateId?: string;
    customPricing?: {
        monthly: number;
        yearly: number;
    };
    tiers?: StripeTier[];
}

export interface StripeSetupResult {
    setupId: string;
    status: "completed" | "failed";
    stripeProductId?: string;
    stripePriceIds: Array<{
        tier: string;
        monthlyId: string;
        yearlyId: string;
    }>;
    error?: string;
}

/**
 * Obtiene todos los templates disponibles de Stripe setup
 */
export async function getStripeSetupTemplates(): Promise<StripeSetupTemplate[]> {
    const rows = await queryAll<{
        id: string;
        slug: string;
        name: string;
        vertical: string;
        suggested_monthly_price: number;
        suggested_yearly_price: number;
        suggested_tiers_json: string;
        default_packs_json: string;
        default_features_json: string;
        default_limits_json: string;
        description: string;
    }>("SELECT * FROM stripe_setup_templates ORDER BY name");

    return rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        vertical: row.vertical,
        suggestedMonthlyPrice: row.suggested_monthly_price,
        suggestedYearlyPrice: row.suggested_yearly_price,
        suggestedTiers: JSON.parse(row.suggested_tiers_json || "[]"),
        defaultPacks: JSON.parse(row.default_packs_json || "[]"),
        defaultFeatures: JSON.parse(row.default_features_json || "[]"),
        defaultLimits: JSON.parse(row.default_limits_json || "{}"),
        description: row.description,
    }));
}

/**
 * Configura Stripe automáticamente para un SaaS
 */
export async function setupStripeForSaas(
    config: StripeSetupConfig,
    tenantId: string,
): Promise<StripeSetupResult> {
    const setupId = globalThis.crypto?.randomUUID?.() ?? `setup_${Date.now()}`;

    // 1. Crear log entry
    await run(
        `INSERT INTO stripe_setup_log (
      id, tenant_id, saas_id, template_id, config_snapshot_json,
      status, current_step, started_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        setupId,
        tenantId,
        config.saasId,
        config.templateId ?? null,
        JSON.stringify(config),
        "in_progress",
        "initializing",
        new Date().toISOString(),
    );

    try {
        // 2. Obtener template si se especificó
        let tiers = config.tiers;
        if (!tiers && config.templateId) {
            const template = await queryOne<{ suggested_tiers_json: string }>(
                "SELECT suggested_tiers_json FROM stripe_setup_templates WHERE id = ?",
                config.templateId,
            );
            if (template) {
                tiers = JSON.parse(template.suggested_tiers_json);
            }
        }

        // Fallback to single tier if no tiers configured
        if (!tiers || tiers.length === 0) {
            tiers = [
                {
                    name: "Standard",
                    monthly: config.customPricing?.monthly ?? 49,
                    yearly: config.customPricing?.yearly ?? 490,
                    features: [],
                },
            ];
        }

        // 3. Verificar Stripe credentials
        const bindings = env();
        if (!bindings?.STRIPE_SECRET_KEY) {
            throw new Error("Stripe not configured (missing STRIPE_SECRET_KEY)");
        }

        // 4. Crear producto en Stripe
        await updateSetupLog(setupId, "creating_product");

        const product = await createStripeProduct({
            name: `${config.saasName}`,
            description: `Subscription plans for ${config.saasName}`,
        });

        // 5. Crear precios para cada tier
        await updateSetupLog(setupId, "creating_prices");

        const priceIds: Array<{ tier: string; monthlyId: string; yearlyId: string }> = [];

        for (const tier of tiers) {
            const monthlyPrice = await createStripePrice({
                productId: product.id,
                amount: Math.round(tier.monthly * 100), // cents
                currency: "usd",
                interval: "month",
                nickname: `${config.saasName} - ${tier.name} (Monthly)`,
            });

            const yearlyPrice = await createStripePrice({
                productId: product.id,
                amount: Math.round(tier.yearly * 100), // cents
                currency: "usd",
                interval: "year",
                nickname: `${config.saasName} - ${tier.name} (Yearly)`,
            });

            priceIds.push({
                tier: tier.name,
                monthlyId: monthlyPrice.id,
                yearlyId: yearlyPrice.id,
            });
        }

        // 6. Mapear a entitlements (usar template defaults si está configurado)
        await updateSetupLog(setupId, "mapping_entitlements");

        if (config.templateId) {
            const template = await queryOne<{
                default_packs_json: string;
                default_features_json: string;
                default_limits_json: string;
            }>("SELECT * FROM stripe_setup_templates WHERE id = ?", config.templateId);

            if (template) {
                // Crear mapping en stripe_mapping table
                for (const priceId of priceIds) {
                    await run(
                        `INSERT INTO stripe_mapping (
              id, tenant_id, project_id, stripe_subscription_id,
              stripe_product_id, stripe_price_id, status,
              packs_json, features_json, limits_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        globalThis.crypto?.randomUUID?.() ?? `map_${Date.now()}_${priceId.tier}`,
                        tenantId,
                        config.saasId,
                        null, // Will be filled when subscription is created
                        product.id,
                        priceId.monthlyId,
                        "template", // Special status for template mappings
                        template.default_packs_json,
                        template.default_features_json,
                        template.default_limits_json,
                    );
                }
            }
        }

        // 7. Marcar como completado
        await run(
            `UPDATE stripe_setup_log
       SET status = ?, current_step = ?,
           stripe_product_id = ?, stripe_price_ids_json = ?,
           completed_at = ?
       WHERE id = ?`,
            "completed",
            "completed",
            product.id,
            JSON.stringify(priceIds),
            new Date().toISOString(),
            setupId,
        );

        return {
            setupId,
            status: "completed",
            stripeProductId: product.id,
            stripePriceIds: priceIds,
        };
    } catch (error) {
        // Marcar como fallido
        const errorMessage = error instanceof Error ? error.message : String(error);
        await run(
            `UPDATE stripe_setup_log
       SET status = ?, error_message = ?, completed_at = ?
       WHERE id = ?`,
            "failed",
            errorMessage,
            new Date().toISOString(),
            setupId,
        );

        return {
            setupId,
            status: "failed",
            stripePriceIds: [],
            error: errorMessage,
        };
    }
}

async function updateSetupLog(setupId: string, step: string): Promise<void> {
    await run("UPDATE stripe_setup_log SET current_step = ? WHERE id = ?", step, setupId);
}

// Stripe API wrappers
async function createStripeProduct(params: {
    name: string;
    description: string;
}): Promise<{ id: string }> {
    const bindings = env();
    const apiKey = bindings?.STRIPE_SECRET_KEY;

    if (!apiKey) {
        throw new Error("Stripe API key not configured");
    }

    const response = await fetch("https://api.stripe.com/v1/products", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
            name: params.name,
            description: params.description,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Stripe API error: ${error}`);
    }

    const product = (await response.json()) as { id: string };
    return product;
}

async function createStripePrice(params: {
    productId: string;
    amount: number;
    currency: string;
    interval: "month" | "year";
    nickname: string;
}): Promise<{ id: string }> {
    const bindings = env();
    const apiKey = bindings?.STRIPE_SECRET_KEY;

    if (!apiKey) {
        throw new Error("Stripe API key not configured");
    }

    const response = await fetch("https://api.stripe.com/v1/prices", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
            product: params.productId,
            currency: params.currency,
            unit_amount: params.amount.toString(),
            "recurring[interval]": params.interval,
            nickname: params.nickname,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Stripe API error: ${error}`);
    }

    const price = (await response.json()) as { id: string };
    return price;
}
