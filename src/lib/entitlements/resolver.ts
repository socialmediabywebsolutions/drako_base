import { queryOne, run } from "@/lib/db";
import type { NormalizedProjectEntitlements } from "@/lib/projects/entitlements";
import { getProjectEntitlements } from "@/lib/projects/entitlements";

/**
 * ENTITLEMENTS RESOLVER CON SOURCE TRACKING
 * ==========================================
 * 
 * Implementa la jerarquía completa de entitlements según arquitectura Campamento Base:
 * 
 * 1. inherited (Company) - Entitlements base de la empresa
 * 2. overridden (Project) - Overrides específicos del proyecto
 * 3. custom - Configuración manual
 * 4. stripe - Entitlements derivados de suscripción Stripe
 * 
 * La precedencia es: Stripe > Custom > Project > Company
 */

export type EntitlementSource = "inherited" | "overridden" | "custom" | "stripe";

export type FeatureWithSource = {
    feature: string;
    source: EntitlementSource;
};

export type PackWithSource = {
    pack: string;
    source: EntitlementSource;
};

export type LimitWithSource = {
    key: string;
    value: number;
    source: EntitlementSource;
};

export type ResolvedEntitlements = {
    features: FeatureWithSource[];
    packs: PackWithSource[];
    limits: LimitWithSource[];
    metadata: {
        tenantId: string;
        projectId: string;
        companyId: string | null;
        stripeSubscriptionId: string | null;
        resolvedAt: string;
    };
};

type QueryOneFn = <T>(sql: string, ...params: unknown[]) => Promise<T | null>;
type RunFn = (sql: string, ...params: unknown[]) => Promise<boolean>;

type DbAdapter = {
    queryOne: QueryOneFn;
    run: RunFn;
};

const defaultDb: DbAdapter = {
    queryOne: queryOne,
    run: run,
};

function resolveDbAdapter(adapter?: Partial<DbAdapter>): DbAdapter {
    if (!adapter) return defaultDb;
    return {
        queryOne: adapter.queryOne ?? defaultDb.queryOne,
        run: adapter.run ?? defaultDb.run,
    };
}

/**
 * Obtiene entitlements de la Company (inherited)
 */
async function getCompanyEntitlements(
    params: { tenantId: string; companyId: string },
    db: DbAdapter,
): Promise<NormalizedProjectEntitlements> {
    // TODO: Implementar tabla company_entitlements
    // Por ahora retornamos vacío
    return {
        enabledFeatures: [],
        enabledPacks: [],
        limits: {},
        metadata: null,
        updatedAt: null,
    };
}

/**
 * Obtiene entitlements derivados de suscripción Stripe
 */
async function getStripeEntitlements(
    params: { tenantId: string; projectId: string },
    db: DbAdapter,
): Promise<NormalizedProjectEntitlements> {
    const row = await db.queryOne<{
        stripe_subscription_id: string;
        stripe_product_id: string;
        stripe_price_id: string;
        status: string;
        packs_json: string | null;
        features_json: string | null;
        limits_json: string | null;
    }>(
        `SELECT
sm.stripe_subscription_id,
    sm.stripe_product_id,
    sm.stripe_price_id,
    sm.status,
    sm.packs_json,
    sm.features_json,
    sm.limits_json
     FROM stripe_mapping sm
     WHERE sm.tenant_id = ? AND sm.project_id = ? AND sm.status = 'active'
     LIMIT 1`,
        params.tenantId,
        params.projectId,
    );

    if (!row || row.status !== "active") {
        return {
            enabledFeatures: [],
            enabledPacks: [],
            limits: {},
            metadata: null,
            updatedAt: null,
        };
    }

    const packs = row.packs_json ? JSON.parse(row.packs_json) : [];
    const features = row.features_json ? JSON.parse(row.features_json) : [];
    const limits = row.limits_json ? JSON.parse(row.limits_json) : {};

    return {
        enabledFeatures: Array.isArray(features) ? features : [],
        enabledPacks: Array.isArray(packs) ? packs : [],
        limits: typeof limits === "object" && limits !== null ? limits : {},
        metadata: {
            stripeSubscriptionId: row.stripe_subscription_id,
            stripeProductId: row.stripe_product_id,
            stripePriceId: row.stripe_price_id,
        },
        updatedAt: new Date().toISOString(),
    };
}

/**
 * Merge entitlements con precedencia: Stripe > Custom > Project > Company
 */
function mergeEntitlements(params: {
    company: NormalizedProjectEntitlements;
    project: NormalizedProjectEntitlements;
    stripe: NormalizedProjectEntitlements;
    tenantId: string;
    projectId: string;
    companyId: string | null;
}): ResolvedEntitlements {
    const featureMap = new Map<string, EntitlementSource>();
    const packMap = new Map<string, EntitlementSource>();
    const limitMap = new Map<string, { value: number; source: EntitlementSource }>();

    // 1. Company (inherited) - lowest priority
    for (const feature of params.company.enabledFeatures) {
        featureMap.set(feature, "inherited");
    }
    for (const pack of params.company.enabledPacks) {
        packMap.set(pack, "inherited");
    }
    for (const [key, value] of Object.entries(params.company.limits)) {
        limitMap.set(key, { value, source: "inherited" });
    }

    // 2. Project (overridden)
    for (const feature of params.project.enabledFeatures) {
        featureMap.set(feature, "overridden");
    }
    for (const pack of params.project.enabledPacks) {
        packMap.set(pack, "overridden");
    }
    for (const [key, value] of Object.entries(params.project.limits)) {
        limitMap.set(key, { value, source: "overridden" });
    }

    // 3. Stripe - highest priority
    for (const feature of params.stripe.enabledFeatures) {
        featureMap.set(feature, "stripe");
    }
    for (const pack of params.stripe.enabledPacks) {
        packMap.set(pack, "stripe");
    }
    for (const [key, value] of Object.entries(params.stripe.limits)) {
        limitMap.set(key, { value, source: "stripe" });
    }

    // Convert maps to arrays
    const features: FeatureWithSource[] = Array.from(featureMap.entries()).map(([feature, source]) => ({
        feature,
        source,
    }));

    const packs: PackWithSource[] = Array.from(packMap.entries()).map(([pack, source]) => ({
        pack,
        source,
    }));

    const limits: LimitWithSource[] = Array.from(limitMap.entries()).map(([key, { value, source }]) => ({
        key,
        value,
        source,
    }));

    return {
        features,
        packs,
        limits,
        metadata: {
            tenantId: params.tenantId,
            projectId: params.projectId,
            companyId: params.companyId,
            stripeSubscriptionId:
                (params.stripe.metadata as { stripeSubscriptionId?: string } | null)?.stripeSubscriptionId ?? null,
            resolvedAt: new Date().toISOString(),
        },
    };
}

/**
 * Resuelve entitlements completos con source tracking
 */
export async function resolveProjectEntitlements(
    props: {
        tenantId: string;
        projectId: string;
        companyId?: string | null;
    },
    adapter?: Partial<DbAdapter>,
): Promise<ResolvedEntitlements> {
    const db = resolveDbAdapter(adapter);
    const tenantId = props.tenantId.trim();
    const projectId = props.projectId.trim();
    const companyId = props.companyId?.trim() ?? null;

    if (!tenantId) throw new Error("tenantId es obligatorio");
    if (!projectId) throw new Error("projectId es obligatorio");

    // Fetch all sources in parallel
    const [company, project, stripe] = await Promise.all([
        companyId ? getCompanyEntitlements({ tenantId, companyId }, db) : Promise.resolve({
            enabledFeatures: [],
            enabledPacks: [],
            limits: {},
            metadata: null,
            updatedAt: null,
        } as NormalizedProjectEntitlements),
        getProjectEntitlements({ tenantId, projectId }, adapter),
        getStripeEntitlements({ tenantId, projectId }, db),
    ]);

    return mergeEntitlements({
        company,
        project,
        stripe,
        tenantId,
        projectId,
        companyId,
    });
}

/**
 * Helper: Verifica si una feature está habilitada (cualquier source)
 */
export function hasFeature(resolved: ResolvedEntitlements, feature: string): boolean {
    return resolved.features.some((f) => f.feature.toLowerCase() === feature.toLowerCase());
}

/**
 * Helper: Verifica si un pack está habilitado (cualquier source)
 */
export function hasPack(resolved: ResolvedEntitlements, pack: string): boolean {
    return resolved.packs.some((p) => p.pack.toLowerCase() === pack.toLowerCase());
}

/**
 * Helper: Obtiene el valor de un límite (o null si no existe)
 */
export function getLimit(resolved: ResolvedEntitlements, key: string): number | null {
    const limit = resolved.limits.find((l) => l.key === key);
    return limit?.value ?? null;
}

/**
 * Helper: Verifica si un límite está dentro del rango permitido
 */
export function isWithinLimit(resolved: ResolvedEntitlements, key: string, current: number): boolean {
    const limit = getLimit(resolved, key);
    if (limit === null) return true; // Sin límite = sin restricción
    return current <= limit;
}
