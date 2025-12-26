import { env as resolveEnv, type DracoEnv } from "@/lib/cf";
import { DEMO_TENANT_ID } from "@/lib/tenants/services";
import {
  listDemoSaasMarketingPlans,
  listDemoSaasMarketingUsage,
  listDemoSaasPaidAdsSpend,
  recordDemoSaasMarketingUsage,
  recordDemoSaasPaidAdsSpend,
  upsertDemoSaasMarketingPlan,
} from "@/lib/admin/demo-data";
import { findBestMatchingPackForPlan, getMarketingPacksForVertical } from "@/lib/saas/marketing-packs";
import type {
  SaasMarketingPlan,
  SaasMarketingSnapshot,
  SaasMarketingUsage,
  SaasMarketingUsageSource,
  SaasPaidAdsChannel,
  SaasPaidAdsSpend,
} from "@/lib/saas/marketing-types";

export type SaasMarketingContextMode = "d1" | "demo";

export type SaasMarketingContext = {
  tenantId: string;
  mode: SaasMarketingContextMode;
  allowDemoFallback: boolean;
  demoTenantId?: string;
  db?: D1Database;
  env?: DracoEnv | null;
};

export class SaasMarketingContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SaasMarketingContextError";
  }
}

const PLAN_TABLE = "saas_marketing_plans";
const USAGE_TABLE = "saas_marketing_usage";
const ADS_TABLE = "saas_paid_ads_spend";
const FALLBACK_ERROR_PATTERNS = ["no such table", "no such column"];

type PlanRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  included_posts_per_month: number;
  included_campaigns_per_month: number;
  extra_post_price: number;
  extra_campaign_price: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type UsageRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  period_month: number;
  period_year: number;
  posts_published: number;
  campaigns_launched: number;
  source: SaasMarketingUsageSource;
  metadata: string | null;
  created_at: string;
  updated_at: string;
};

type PaidAdsRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  period_month: number;
  period_year: number;
  channel: SaasPaidAdsChannel;
  amount: number;
  currency: string;
  billed_to_client: number;
  metadata: string | null;
  created_at: string;
  updated_at: string;
};

function resolveEnvOverride(envOverride?: DracoEnv | null): DracoEnv | null {
  if (envOverride) return envOverride;
  return resolveEnv();
}

function hasDatabase(envOverride?: DracoEnv | null): boolean {
  return Boolean(resolveEnvOverride(envOverride)?.DRACO_DB);
}

function isDemoFeatureEnabled(tenantId: string, envOverride?: DracoEnv | null): boolean {
  if (tenantId === DEMO_TENANT_ID) return true;
  const runtimeEnv = resolveEnvOverride(envOverride);
  const flag = runtimeEnv?.DRAKO_DEMO_MODE ?? process.env.DRAKO_DEMO_MODE;
  return typeof flag === "string" && flag.toLowerCase() === "true";
}

function shouldFallbackToDemo(error: unknown, ctx: SaasMarketingContext): boolean {
  if (ctx.mode !== "d1" || !ctx.allowDemoFallback) return false;
  const message = (error instanceof Error ? error.message : `${error ?? ""}`).toLowerCase();
  return FALLBACK_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}

function parseMetadata(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function serializeMetadata(metadata: Record<string, unknown> | null | undefined): string | null {
  if (!metadata) return null;
  try {
    return JSON.stringify(metadata);
  } catch {
    return null;
  }
}

function generateUuid(): string {
  const globalCrypto = typeof globalThis !== "undefined" ? (globalThis.crypto as { randomUUID?: () => string } | undefined) : undefined;
  if (globalCrypto?.randomUUID) {
    try {
      return globalCrypto.randomUUID();
    } catch {
      // ignore and fallback
    }
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function demoTenantId(ctx: SaasMarketingContext): string {
  return ctx.demoTenantId ?? ctx.tenantId;
}

async function queryAllWithCtx<T>(ctx: SaasMarketingContext, sql: string, ...params: unknown[]): Promise<T[]> {
  if (ctx.mode !== "d1") return [];
  const db = ctx.db ?? resolveEnvOverride(ctx.env)?.DRACO_DB;
  if (!db) return [];
  const stmt = db.prepare(sql);
  const bound = params.length ? stmt.bind(...params) : stmt;
  const res = await bound.all<T>();
  return res.results ?? [];
}

async function runWithCtx(ctx: SaasMarketingContext, sql: string, ...params: unknown[]): Promise<boolean> {
  if (ctx.mode !== "d1") return false;
  const db = ctx.db ?? resolveEnvOverride(ctx.env)?.DRACO_DB;
  if (!db) return false;
  const stmt = db.prepare(sql);
  const bound = params.length ? stmt.bind(...params) : stmt;
  const res = await bound.run();
  return Boolean(res?.success);
}

function mapPlanRow(row: PlanRow): SaasMarketingPlan {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    includedPostsPerMonth: row.included_posts_per_month,
    includedCampaignsPerMonth: row.included_campaigns_per_month,
    extraPostPrice: Number(row.extra_post_price),
    extraCampaignPrice: Number(row.extra_campaign_price),
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapUsageRow(row: UsageRow): SaasMarketingUsage {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    periodMonth: row.period_month,
    periodYear: row.period_year,
    postsPublished: row.posts_published,
    campaignsLaunched: row.campaigns_launched,
    source: row.source,
    metadata: parseMetadata(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPaidAdsRow(row: PaidAdsRow): SaasPaidAdsSpend {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    periodMonth: row.period_month,
    periodYear: row.period_year,
    channel: row.channel,
    amount: Number(row.amount),
    currency: row.currency,
    billedToClient: Boolean(row.billed_to_client),
    metadata: parseMetadata(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDemoPlan(row: {
  id: string;
  tenant_id: string;
  saas_id: string;
  included_posts_per_month: number;
  included_campaigns_per_month: number;
  extra_post_price: number;
  extra_campaign_price: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}): SaasMarketingPlan {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    includedPostsPerMonth: row.included_posts_per_month,
    includedCampaignsPerMonth: row.included_campaigns_per_month,
    extraPostPrice: row.extra_post_price,
    extraCampaignPrice: row.extra_campaign_price,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDemoUsage(row: {
  id: string;
  tenant_id: string;
  saas_id: string;
  period_month: number;
  period_year: number;
  posts_published: number;
  campaigns_launched: number;
  source: SaasMarketingUsageSource;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}): SaasMarketingUsage {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    periodMonth: row.period_month,
    periodYear: row.period_year,
    postsPublished: row.posts_published,
    campaignsLaunched: row.campaigns_launched,
    source: row.source,
    metadata: row.metadata ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDemoPaidAds(row: {
  id: string;
  tenant_id: string;
  saas_id: string;
  period_month: number;
  period_year: number;
  channel: SaasPaidAdsChannel;
  amount: number;
  currency: string;
  billed_to_client: number;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}): SaasPaidAdsSpend {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    periodMonth: row.period_month,
    periodYear: row.period_year,
    channel: row.channel,
    amount: row.amount,
    currency: row.currency,
    billedToClient: row.billed_to_client === 1,
    metadata: row.metadata ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function resolveSaasMarketingContext({
  tenantId,
  env,
}: {
  tenantId: string;
  env?: DracoEnv | null;
}): Promise<SaasMarketingContext> {
  const demoEnabled = isDemoFeatureEnabled(tenantId, env);

  if (hasDatabase(env)) {
    const runtimeEnv = resolveEnvOverride(env);
    return {
      tenantId,
      mode: "d1",
      allowDemoFallback: demoEnabled,
      demoTenantId: demoEnabled ? DEMO_TENANT_ID : undefined,
      db: runtimeEnv?.DRACO_DB,
      env: runtimeEnv,
    };
  }

  if (!demoEnabled) {
    throw new SaasMarketingContextError("Marketing data is not enabled for this tenant.");
  }

  return {
    tenantId,
    mode: "demo",
    allowDemoFallback: true,
    demoTenantId: DEMO_TENANT_ID,
    env: resolveEnvOverride(env),
  };
}

export async function getSaasMarketingPlan(ctx: SaasMarketingContext, saasId: string): Promise<SaasMarketingPlan | null> {
  if (ctx.mode === "d1") {
    try {
      const rows = await queryAllWithCtx<PlanRow>(ctx, `SELECT * FROM ${PLAN_TABLE} WHERE tenant_id = ? AND saas_id = ?`, ctx.tenantId, saasId);
      return rows[0] ? mapPlanRow(rows[0]) : null;
    } catch (error) {
      if (shouldFallbackToDemo(error, ctx)) {
        const demoRow = listDemoSaasMarketingPlans(demoTenantId(ctx)).find((item) => item.saas_id === saasId);
        return demoRow ? mapDemoPlan(demoRow) : null;
      }
      throw error;
    }
  }

  const demoRow = listDemoSaasMarketingPlans(demoTenantId(ctx)).find((item) => item.saas_id === saasId);
  return demoRow ? mapDemoPlan(demoRow) : null;
}

export async function upsertSaasMarketingPlan(
  ctx: SaasMarketingContext,
  input: {
    id?: string;
    saasId: string;
    includedPostsPerMonth: number;
    includedCampaignsPerMonth: number;
    extraPostPrice: number;
    extraCampaignPrice: number;
    notes?: string | null;
  },
): Promise<SaasMarketingPlan> {
  const now = new Date().toISOString();
  const id = input.id?.trim() ?? generateUuid();
  if (ctx.mode === "d1") {
    try {
      await runWithCtx(
        ctx,
        `INSERT INTO ${PLAN_TABLE} (
          id, tenant_id, saas_id, included_posts_per_month, included_campaigns_per_month, extra_post_price, extra_campaign_price, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          included_posts_per_month = excluded.included_posts_per_month,
          included_campaigns_per_month = excluded.included_campaigns_per_month,
          extra_post_price = excluded.extra_post_price,
          extra_campaign_price = excluded.extra_campaign_price,
          notes = excluded.notes,
          updated_at = excluded.updated_at`,
        id,
        ctx.tenantId,
        input.saasId,
        input.includedPostsPerMonth,
        input.includedCampaignsPerMonth,
        input.extraPostPrice,
        input.extraCampaignPrice,
        input.notes ?? null,
        now,
        now,
      );
      const rows = await queryAllWithCtx<PlanRow>(ctx, `SELECT * FROM ${PLAN_TABLE} WHERE id = ?`, id);
      return rows[0] ? mapPlanRow(rows[0]) : {
        id,
        tenantId: ctx.tenantId,
        saasId: input.saasId,
        includedPostsPerMonth: input.includedPostsPerMonth,
        includedCampaignsPerMonth: input.includedCampaignsPerMonth,
        extraPostPrice: input.extraPostPrice,
        extraCampaignPrice: input.extraCampaignPrice,
        notes: input.notes ?? null,
        createdAt: now,
        updatedAt: now,
      };
    } catch (error) {
      if (shouldFallbackToDemo(error, ctx)) {
        const demoRecord = upsertDemoSaasMarketingPlan(demoTenantId(ctx), {
          id: input.id,
          saas_id: input.saasId,
          included_posts_per_month: input.includedPostsPerMonth,
          included_campaigns_per_month: input.includedCampaignsPerMonth,
          extra_post_price: input.extraPostPrice,
          extra_campaign_price: input.extraCampaignPrice,
          notes: input.notes ?? null,
        });
        return mapDemoPlan(demoRecord);
      }
      throw error;
    }
  }

  const demoRecord = upsertDemoSaasMarketingPlan(demoTenantId(ctx), {
    id: input.id,
    saas_id: input.saasId,
    included_posts_per_month: input.includedPostsPerMonth,
    included_campaigns_per_month: input.includedCampaignsPerMonth,
    extra_post_price: input.extraPostPrice,
    extra_campaign_price: input.extraCampaignPrice,
    notes: input.notes ?? null,
  });
  return mapDemoPlan(demoRecord);
}

export async function getSaasMarketingSnapshotForMonth(
  ctx: SaasMarketingContext,
  saasId: string,
  params: { month: number; year: number; verticalId?: string | null },
): Promise<SaasMarketingSnapshot> {
  const plan = (await getSaasMarketingPlan(ctx, saasId)) ?? {
    id: "default",
    tenantId: ctx.tenantId,
    saasId,
    includedPostsPerMonth: 8,
    includedCampaignsPerMonth: 0,
    extraPostPrice: 0,
    extraCampaignPrice: 0,
    notes: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const usageRows =
    ctx.mode === "d1"
      ? await queryAllWithCtx<UsageRow>(
          ctx,
          `SELECT * FROM ${USAGE_TABLE} WHERE tenant_id = ? AND saas_id = ? AND period_year = ? AND period_month = ?`,
          ctx.tenantId,
          saasId,
          params.year,
          params.month,
        ).then((rows) => rows.map(mapUsageRow))
      : listDemoSaasMarketingUsage(demoTenantId(ctx), { saasId, month: params.month, year: params.year }).map(mapDemoUsage);

  const paidAdsRows =
    ctx.mode === "d1"
      ? await queryAllWithCtx<PaidAdsRow>(
          ctx,
          `SELECT * FROM ${ADS_TABLE} WHERE tenant_id = ? AND saas_id = ? AND period_year = ? AND period_month = ?`,
          ctx.tenantId,
          saasId,
          params.year,
          params.month,
        ).then((rows) => rows.map(mapPaidAdsRow))
      : listDemoSaasPaidAdsSpend(demoTenantId(ctx), { saasId, month: params.month, year: params.year }).map(mapDemoPaidAds);

  const postsPublishedThisMonth = usageRows.reduce((acc, row) => acc + row.postsPublished, 0);
  const campaignsLaunchedThisMonth = usageRows.reduce((acc, row) => acc + row.campaignsLaunched, 0);

  const paidAdsTotalThisMonth = paidAdsRows.reduce((acc, row) => acc + row.amount, 0);
  const paidAdsByChannel = new Map<SaasPaidAdsChannel, { amount: number; currency: string }>();
  paidAdsRows.forEach((row) => {
    const current = paidAdsByChannel.get(row.channel) ?? { amount: 0, currency: row.currency };
    paidAdsByChannel.set(row.channel, { amount: current.amount + row.amount, currency: row.currency });
  });

  const usagePostsPercent =
    plan.includedPostsPerMonth > 0 ? Math.min(1, postsPublishedThisMonth / plan.includedPostsPerMonth) : 0;
  const usageCampaignsPercent =
    plan.includedCampaignsPerMonth > 0 ? Math.min(1, campaignsLaunchedThisMonth / plan.includedCampaignsPerMonth) : 0;
  const isNearLimit =
    plan.includedPostsPerMonth > 0 ? postsPublishedThisMonth >= plan.includedPostsPerMonth * 0.8 : false;

  const verticalId = params.verticalId ?? null;
  const { pack: currentPackDefinition, tier: currentPackTier } = findBestMatchingPackForPlan({
    verticalId,
    plan: {
      includedPostsPerMonth: plan.includedPostsPerMonth,
      includedCampaignsPerMonth: plan.includedCampaignsPerMonth,
    },
  });
  const packOptions = getMarketingPacksForVertical(verticalId);
  const currentIndex = currentPackTier ? packOptions.findIndex((pack) => pack.tier === currentPackTier) : -1;
  const shouldUpgrade =
    plan.includedPostsPerMonth > 0 && postsPublishedThisMonth >= plan.includedPostsPerMonth * 0.9;
  const shouldDowngrade =
    plan.includedPostsPerMonth > 0 &&
    postsPublishedThisMonth <= plan.includedPostsPerMonth * 0.4 &&
    currentIndex > 0;
  let recommendedPackDefinition = currentPackDefinition;
  let recommendedPackTier = currentPackTier;
  if (shouldUpgrade && currentIndex >= 0 && currentIndex < packOptions.length - 1) {
    recommendedPackDefinition = packOptions[currentIndex + 1] ?? currentPackDefinition;
    recommendedPackTier = recommendedPackDefinition?.tier ?? currentPackTier;
  } else if (shouldDowngrade && currentIndex > 0) {
    recommendedPackDefinition = packOptions[currentIndex - 1] ?? currentPackDefinition;
    recommendedPackTier = recommendedPackDefinition?.tier ?? currentPackTier;
  }

  return {
    saasId,
    periodMonth: params.month,
    periodYear: params.year,
    includedPostsPerMonth: plan.includedPostsPerMonth,
    postsPublishedThisMonth,
    includedCampaignsPerMonth: plan.includedCampaignsPerMonth,
    campaignsLaunchedThisMonth,
    usagePostsPercent,
    usageCampaignsPercent,
    isNearLimit,
    paidAdsTotalThisMonth,
    paidAdsByChannel: Array.from(paidAdsByChannel.entries()).map(([channel, entry]) => ({
      channel,
      amount: entry.amount,
      currency: entry.currency,
    })),
    currentPackTier: currentPackTier ?? null,
    currentPackDefinition: currentPackDefinition ?? null,
    recommendedPackTier: recommendedPackTier ?? null,
    recommendedPackDefinition: recommendedPackDefinition ?? null,
  };
}

export async function recordMarketingUsage(
  ctx: SaasMarketingContext,
  input: {
    saasId: string;
    month: number;
    year: number;
    postsDelta?: number;
    campaignsDelta?: number;
    source: SaasMarketingUsageSource;
    metadata?: Record<string, unknown> | null;
  },
): Promise<SaasMarketingUsage> {
  const now = new Date().toISOString();
  const id = generateUuid();
  const posts = input.postsDelta ?? 0;
  const campaigns = input.campaignsDelta ?? 0;
  if (ctx.mode === "d1") {
    try {
      await runWithCtx(
        ctx,
        `INSERT INTO ${USAGE_TABLE} (
          id, tenant_id, saas_id, period_month, period_year, posts_published, campaigns_launched, source, metadata, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        ctx.tenantId,
        input.saasId,
        input.month,
        input.year,
        posts,
        campaigns,
        input.source,
        serializeMetadata(input.metadata),
        now,
        now,
      );
      const rows = await queryAllWithCtx<UsageRow>(ctx, `SELECT * FROM ${USAGE_TABLE} WHERE id = ?`, id);
      return rows[0] ? mapUsageRow(rows[0]) : {
        id,
        tenantId: ctx.tenantId,
        saasId: input.saasId,
        periodMonth: input.month,
        periodYear: input.year,
        postsPublished: posts,
        campaignsLaunched: campaigns,
        source: input.source,
        metadata: input.metadata ?? null,
        createdAt: now,
        updatedAt: now,
      };
    } catch (error) {
      if (shouldFallbackToDemo(error, ctx)) {
        const demoRecord = recordDemoSaasMarketingUsage(demoTenantId(ctx), {
          saas_id: input.saasId,
          period_month: input.month,
          period_year: input.year,
          posts_published: posts,
          campaigns_launched: campaigns,
          source: input.source,
          metadata: input.metadata ?? null,
        });
        return mapDemoUsage(demoRecord);
      }
      throw error;
    }
  }

  const demoRecord = recordDemoSaasMarketingUsage(demoTenantId(ctx), {
    saas_id: input.saasId,
    period_month: input.month,
    period_year: input.year,
    posts_published: posts,
    campaigns_launched: campaigns,
    source: input.source,
    metadata: input.metadata ?? null,
  });
  return mapDemoUsage(demoRecord);
}

export async function recordPaidAdsSpend(
  ctx: SaasMarketingContext,
  input: {
    saasId: string;
    month: number;
    year: number;
    channel: SaasPaidAdsChannel;
    amount: number;
    currency?: string;
    billedToClient?: boolean;
    metadata?: Record<string, unknown> | null;
  },
): Promise<SaasPaidAdsSpend> {
  const now = new Date().toISOString();
  const id = generateUuid();
  if (ctx.mode === "d1") {
    try {
      await runWithCtx(
        ctx,
        `INSERT INTO ${ADS_TABLE} (
          id, tenant_id, saas_id, period_month, period_year, channel, amount, currency, billed_to_client, metadata, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        ctx.tenantId,
        input.saasId,
        input.month,
        input.year,
        input.channel,
        input.amount,
        input.currency ?? "EUR",
        input.billedToClient === false ? 0 : 1,
        serializeMetadata(input.metadata),
        now,
        now,
      );
      const rows = await queryAllWithCtx<PaidAdsRow>(ctx, `SELECT * FROM ${ADS_TABLE} WHERE id = ?`, id);
      return rows[0] ? mapPaidAdsRow(rows[0]) : {
        id,
        tenantId: ctx.tenantId,
        saasId: input.saasId,
        periodMonth: input.month,
        periodYear: input.year,
        channel: input.channel,
        amount: input.amount,
        currency: input.currency ?? "EUR",
        billedToClient: input.billedToClient !== false,
        metadata: input.metadata ?? null,
        createdAt: now,
        updatedAt: now,
      };
    } catch (error) {
      if (shouldFallbackToDemo(error, ctx)) {
        const demoRecord = recordDemoSaasPaidAdsSpend(demoTenantId(ctx), {
          saas_id: input.saasId,
          period_month: input.month,
          period_year: input.year,
          channel: input.channel,
          amount: input.amount,
          currency: input.currency ?? "EUR",
          billed_to_client: input.billedToClient === false ? 0 : 1,
          metadata: input.metadata ?? null,
        });
        return mapDemoPaidAds(demoRecord);
      }
      throw error;
    }
  }

  const demoRecord = recordDemoSaasPaidAdsSpend(demoTenantId(ctx), {
    saas_id: input.saasId,
    period_month: input.month,
    period_year: input.year,
    channel: input.channel,
    amount: input.amount,
    currency: input.currency ?? "EUR",
    billed_to_client: input.billedToClient === false ? 0 : 1,
    metadata: input.metadata ?? null,
  });
  return mapDemoPaidAds(demoRecord);
}
