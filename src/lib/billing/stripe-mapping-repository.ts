import { queryAll, run } from "@/lib/db";

export type StripePriceMeta = {
  currency: string;
  interval: "month" | "year";
  amountCents: number;
};

export type StripeMappingRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  saas_slug: string;
  stripe_product_id: string;
  stripe_price_ids: string;
  stripe_price_meta: string;
  created_at: string;
  updated_at: string;
};

export type StripeMapping = {
  id: string;
  tenantId: string;
  saasId: string;
  saasSlug: string;
  stripeProductId: string;
  stripePriceIds: Record<string, string>;
  stripePriceMeta: Record<string, StripePriceMeta>;
  createdAt: string;
  updatedAt: string;
};

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function mapRow(row: StripeMappingRow): StripeMapping {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    saasSlug: row.saas_slug,
    stripeProductId: row.stripe_product_id,
    stripePriceIds: parseJson<Record<string, string>>(row.stripe_price_ids, {}),
    stripePriceMeta: parseJson<Record<string, StripePriceMeta>>(row.stripe_price_meta, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function findStripeMapping(params: {
  tenantId: string;
  saasId: string;
  saasSlug: string;
}): Promise<StripeMapping | null> {
  const rows = await queryAll<StripeMappingRow>(
    `SELECT id, tenant_id, saas_id, saas_slug, stripe_product_id, stripe_price_ids, stripe_price_meta, created_at, updated_at
     FROM saas_stripe_mapping
     WHERE tenant_id = ? AND (saas_id = ? OR saas_slug = ?)
     ORDER BY updated_at DESC
     LIMIT 1`,
    params.tenantId,
    params.saasId,
    params.saasSlug,
  );
  if (!rows[0]) return null;
  return mapRow(rows[0]);
}

export async function upsertStripeMapping(params: {
  tenantId: string;
  saasId: string;
  saasSlug: string;
  stripeProductId: string;
  stripePriceIds: Record<string, string>;
  stripePriceMeta: Record<string, StripePriceMeta>;
}): Promise<StripeMapping | null> {
  const now = new Date().toISOString();
  const id = `${params.tenantId}_${params.saasId}`;
  const ok = await run(
    `INSERT INTO saas_stripe_mapping (id, tenant_id, saas_id, saas_slug, stripe_product_id, stripe_price_ids, stripe_price_meta, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       saas_slug = excluded.saas_slug,
       stripe_product_id = excluded.stripe_product_id,
       stripe_price_ids = excluded.stripe_price_ids,
       stripe_price_meta = excluded.stripe_price_meta,
       updated_at = excluded.updated_at`,
    id,
    params.tenantId,
    params.saasId,
    params.saasSlug,
    params.stripeProductId,
    JSON.stringify(params.stripePriceIds ?? {}),
    JSON.stringify(params.stripePriceMeta ?? {}),
    now,
    now,
  );
  if (!ok) return null;
  const rows = await queryAll<StripeMappingRow>(
    `SELECT id, tenant_id, saas_id, saas_slug, stripe_product_id, stripe_price_ids, stripe_price_meta, created_at, updated_at
     FROM saas_stripe_mapping
     WHERE id = ?
     LIMIT 1`,
    id,
  );
  if (!rows[0]) return null;
  return mapRow(rows[0]);
}

export async function findStripeMappingByStripeIds(params: {
  tenantId?: string | null;
  stripeProductId?: string | null;
  stripePriceId?: string | null;
}): Promise<StripeMapping | null> {
  if (!params.stripeProductId && !params.stripePriceId) {
    return null;
  }

  if (params.stripeProductId) {
    const rows = await queryAll<StripeMappingRow>(
      `SELECT id, tenant_id, saas_id, saas_slug, stripe_product_id, stripe_price_ids, stripe_price_meta, created_at, updated_at
       FROM saas_stripe_mapping
       WHERE stripe_product_id = ? ${params.tenantId ? "AND tenant_id = ?" : ""}
       LIMIT 1`,
      ...(params.tenantId ? [params.stripeProductId, params.tenantId] : [params.stripeProductId]),
    );
    if (rows[0]) return mapRow(rows[0]);
  }

  if (params.stripePriceId) {
    const rows = await queryAll<StripeMappingRow>(
      `SELECT id, tenant_id, saas_id, saas_slug, stripe_product_id, stripe_price_ids, stripe_price_meta, created_at, updated_at
       FROM saas_stripe_mapping
       WHERE stripe_price_ids LIKE ? ${params.tenantId ? "AND tenant_id = ?" : ""}
       LIMIT 5`,
      ...(params.tenantId ? [`%${params.stripePriceId}%`, params.tenantId] : [`%${params.stripePriceId}%`]),
    );
    for (const row of rows) {
      const parsed = parseJson<Record<string, string>>(row.stripe_price_ids, {});
      if (Object.values(parsed).includes(params.stripePriceId)) {
        return mapRow(row);
      }
    }
  }

  return null;
}
