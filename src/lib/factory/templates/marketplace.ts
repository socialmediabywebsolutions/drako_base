import { queryOne, queryAll, run } from "@/lib/db";
import { upsertProjectEntitlements } from "@/lib/projects/entitlements";

export interface SaasTemplate {
    id: string;
    slug: string;
    name: string;
    description: string;
    vertical: string;
    tier: "free" | "pro" | "enterprise";
    priceUsd: number;
    defaultEntitlements: {
        packs: string[];
        features: string[];
        limits: Record<string, number>;
    };
    defaultBranding: {
        colors: { primary: string; secondary: string };
        fonts: { heading: string; body: string };
    } | null;
    stripePricingTiers: Array<{
        name: string;
        monthly: number;
        yearly: number;
        features: string[];
    }>;
    previewImageUrl: string | null;
    demoUrl: string | null;
    tagline: string | null;
    keyFeatures: string[];
    targetAudience: string | null;
    useCases: string[];
    installations: number;
    rating: number;
    isOfficial: boolean;
    isFeatured: boolean;
}

export interface DeployTemplateParams {
    templateId: string;
    tenantId: string;
    customization: {
        name: string;
        slug: string;
        domain?: string;
        branding?: {
            primaryColor?: string;
            secondaryColor?: string;
        };
    };
}

export interface DeployedSaas {
    saasId: string;
    name: string;
    slug: string;
    status: "active";
    templateUsed: string;
    entitlementsApplied: boolean;
}

/**
 * Obtiene todos los templates disponibles
 */
export async function getAllTemplates(params?: {
    vertical?: string;
    tier?: string;
    featuredOnly?: boolean;
}): Promise<SaasTemplate[]> {
    let sql = `
    SELECT 
      t.*,
      COALESCE(s.avg_rating, 0) as avg_rating,
      COALESCE(s.review_count, 0) as review_count
    FROM saas_blueprint_templates t
    LEFT JOIN v_template_stats s ON s.id = t.id
    WHERE t.is_public = TRUE
  `;

    const conditions: string[] = [];
    const sqlParams: unknown[] = [];

    if (params?.vertical) {
        conditions.push("t.vertical = ?");
        sqlParams.push(params.vertical);
    }

    if (params?.tier) {
        conditions.push("t.tier = ?");
        sqlParams.push(params.tier);
    }

    if (params?.featuredOnly) {
        conditions.push("t.is_featured = TRUE");
    }

    if (conditions.length > 0) {
        sql += ` AND ${conditions.join(" AND ")}`;
    }

    sql += ` ORDER BY t.is_featured DESC, t.rating DESC, t.installations DESC`;

    const rows = await queryAll<{
        id: string;
        slug: string;
        name: string;
        description: string;
        vertical: string;
        tier: "free" | "pro" | "enterprise";
        price_usd: number;
        default_entitlements_json: string;
        default_branding_json: string | null;
        stripe_pricing_tiers_json: string;
        preview_image_url: string | null;
        demo_url: string | null;
        tagline: string | null;
        key_features_json: string;
        target_audience: string | null;
        use_cases_json: string;
        installations: number;
        avg_rating: number;
        is_official: number;
        is_featured: number;
    }>(sql, ...sqlParams);

    return rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        description: row.description,
        vertical: row.vertical,
        tier: row.tier,
        priceUsd: row.price_usd,
        defaultEntitlements: JSON.parse(row.default_entitlements_json),
        defaultBranding: row.default_branding_json ? JSON.parse(row.default_branding_json) : null,
        stripePricingTiers: JSON.parse(row.stripe_pricing_tiers_json || "[]"),
        previewImageUrl: row.preview_image_url,
        demoUrl: row.demo_url,
        tagline: row.tagline,
        keyFeatures: JSON.parse(row.key_features_json || "[]"),
        targetAudience: row.target_audience,
        useCases: JSON.parse(row.use_cases_json || "[]"),
        installations: row.installations,
        rating: row.avg_rating,
        isOfficial: Boolean(row.is_official),
        isFeatured: Boolean(row.is_featured),
    }));
}

/**
 * Obtiene un template por ID o slug
 */
export async function getTemplate(idOrSlug: string): Promise<SaasTemplate | null> {
    const row = await queryOne<{
        id: string;
        slug: string;
        name: string;
        description: string;
        vertical: string;
        tier: "free" | "pro" | "enterprise";
        price_usd: number;
        default_entitlements_json: string;
        default_branding_json: string | null;
        stripe_pricing_tiers_json: string;
        preview_image_url: string | null;
        demo_url: string | null;
        tagline: string | null;
        key_features_json: string;
        target_audience: string | null;
        use_cases_json: string;
        installations: number;
        rating: number;
        is_official: number;
        is_featured: number;
    }>(
        `SELECT t.*, COALESCE(s.avg_rating, 0) as rating
     FROM saas_blueprint_templates t
     LEFT JOIN v_template_stats s ON s.id = t.id
     WHERE (t.id = ? OR t.slug = ?) AND t.is_public = TRUE
     LIMIT 1`,
        idOrSlug,
        idOrSlug,
    );

    if (!row) return null;

    return {
        id: row.id,
        slug: row.slug,
        name: row.name,
        description: row.description,
        vertical: row.vertical,
        tier: row.tier,
        priceUsd: row.price_usd,
        defaultEntitlements: JSON.parse(row.default_entitlements_json),
        defaultBranding: row.default_branding_json ? JSON.parse(row.default_branding_json) : null,
        stripePricingTiers: JSON.parse(row.stripe_pricing_tiers_json || "[]"),
        previewImageUrl: row.preview_image_url,
        demoUrl: row.demo_url,
        tagline: row.tagline,
        keyFeatures: JSON.parse(row.key_features_json || "[]"),
        targetAudience: row.target_audience,
        useCases: JSON.parse(row.use_cases_json || "[]"),
        installations: row.installations,
        rating: row.rating,
        isOfficial: Boolean(row.is_official),
        isFeatured: Boolean(row.is_featured),
    };
}

/**
 * Despliega un template como nuevo SaaS
 */
export async function deployTemplate(params: DeployTemplateParams): Promise<DeployedSaas> {
    const { templateId, tenantId, customization } = params;

    // 1. Obtener template
    const template = await getTemplate(templateId);
    if (!template) {
        throw new Error(`Template not found: ${templateId}`);
    }

    // 2. Crear proyecto SaaS
    const saasId = globalThis.crypto?.randomUUID?.() ?? `saas_${Date.now()}`;
    const now = new Date().toISOString();

    await run(
        `INSERT INTO saas_instances (
      id, tenant_id, name, slug, status, plan_tier, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        saasId,
        tenantId,
        customization.name,
        customization.slug,
        "active",
        template.tier === "free" ? "starter" : template.tier,
        now,
        now,
    );

    // Legacy Mirror
    await run(
        `INSERT INTO saas_projects (
      id, tenant_id, name, slug, vertical, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        saasId,
        tenantId,
        customization.name,
        customization.slug,
        template.vertical,
        "active",
        now,
        now,
    );

    // 3. Aplicar entitlements del template
    await upsertProjectEntitlements({
        tenantId,
        projectId: saasId,
        entitlements: {
            enabledPacks: template.defaultEntitlements.packs,
            enabledFeatures: template.defaultEntitlements.features,
            limits: template.defaultEntitlements.limits,
            metadata: {
                deployedFromTemplate: templateId,
                templateVersion: "1.0",
            },
        },
    });

    // 4. Aplicar branding si existe
    if (template.defaultBranding || customization.branding) {
        const primaryColor = customization.branding?.primaryColor ?? template.defaultBranding?.colors.primary ?? "#3B82F6";
        const secondaryColor =
            customization.branding?.secondaryColor ?? template.defaultBranding?.colors.secondary ?? "#10B981";

        await run(
            `INSERT INTO saas_branding (
        id, tenant_id, saas_id, primary_color, secondary_color, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            globalThis.crypto?.randomUUID?.() ?? `brand_${Date.now()}`,
            tenantId,
            saasId,
            primaryColor,
            secondaryColor,
            now,
            now,
        );
    }

    // 5. Registrar instalación
    await run(
        `INSERT INTO saas_template_installations (
      id, tenant_id, saas_id, template_id, custom_name, custom_domain,
      customizations_json, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        globalThis.crypto?.randomUUID?.() ?? `install_${Date.now()}`,
        tenantId,
        saasId,
        templateId,
        customization.name,
        customization.domain ?? null,
        JSON.stringify(customization),
        "active",
    );

    // 6. Incrementar contador de instalaciones
    await run(
        `UPDATE saas_blueprint_templates
     SET installations = installations + 1
     WHERE id = ?`,
        templateId,
    );

    return {
        saasId,
        name: customization.name,
        slug: customization.slug,
        status: "active",
        templateUsed: template.name,
        entitlementsApplied: true,
    };
}

/**
 * Registra una review para un template
 */
export async function addTemplateReview(params: {
    templateId: string;
    tenantId: string;
    saasId?: string;
    rating: number;
    reviewText?: string;
}): Promise<void> {
    const { templateId, tenantId, saasId, rating, reviewText } = params;

    if (rating < 1 || rating > 5) {
        throw new Error("Rating must be between 1 and 5");
    }

    const reviewId = globalThis.crypto?.randomUUID?.() ?? `review_${Date.now()}`;

    await run(
        `INSERT INTO saas_template_reviews (
      id, tenant_id, template_id, saas_id, rating, review_text
    ) VALUES (?, ?, ?, ?, ?, ?)`,
        reviewId,
        tenantId,
        templateId,
        saasId ?? null,
        rating,
        reviewText ?? null,
    );
}
