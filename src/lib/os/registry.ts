import { env } from '@/lib/cf';

export interface SaasRegistryItem {
    id: string;
    slug: string;
    name: string;
    status: string;
    plan_tier: string;
    created_at: string;
}

export async function getSaasIdBySlug(slug: string): Promise<string | null> {
    const bindings = env();
    const db = bindings?.DRACO_DB;
    if (!db) return null;

    try {
        const result = await db.prepare(
            `SELECT id FROM saas_instances WHERE slug = ?`
        ).bind(slug).first<{ id: string }>();

        return result?.id || null;
    } catch (e) {
        console.error("Registry Lookup Failed:", e);
        return null;
    }
}

export async function getSlugBySaasId(id: string): Promise<string | null> {
    const bindings = env();
    const db = bindings?.DRACO_DB;
    if (!db) return null;

    try {
        const result = await db.prepare(
            `SELECT slug FROM saas_instances WHERE id = ?`
        ).bind(id).first<{ slug: string }>();

        return result?.slug || null;
    } catch (e) {
        console.error("Registry Reverse Lookup Failed:", e);
        return null;
    }
}

export async function getSaasRegistry(): Promise<SaasRegistryItem[]> {
    const bindings = env();
    const db = bindings?.DRACO_DB;
    if (!db) return [];

    try {
        const result = await db.prepare(
            `SELECT id, slug, name, status, plan_tier, created_at FROM saas_instances ORDER BY name ASC`
        ).all<SaasRegistryItem>();

        return result.results || [];
    } catch (e) {
        console.error("Registry List Failed:", e);
        return [];
    }
}
