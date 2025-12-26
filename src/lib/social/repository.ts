import { env as resolveEnv, type DracoEnv } from "@/lib/cf";
import {
  listDemoSaasSocialAccounts,
  listDemoSaasSocialCampaigns,
  listDemoSaasSocialMetricsForPost,
  listDemoSaasSocialPosts,
  getDemoSaasSocialPostById,
  upsertDemoSaasSocialAccount,
  upsertDemoSaasSocialCampaign,
  upsertDemoSaasSocialPost,
  updateDemoSaasSocialPostStatus,
} from "@/lib/admin/demo-data";
import { listAppointmentsForSaas, resolveAppointmentsContext } from "@/lib/appointments/repository";
import { listSaasServices, resolveEconomyContext } from "@/lib/economy/repository";
import { DEMO_TENANT_ID } from "@/lib/tenants/services";
import type {
  SaasSocialAccount,
  SaasSocialCampaign,
  SaasSocialMetrics,
  SaasSocialPost,
  SaasSocialProvider,
  SocialCampaignPerformance,
  SocialConversionSnapshot,
  SocialPostPerformance,
} from "@/lib/social/types";

export type SocialContextMode = "d1" | "demo";

export type SocialContext = {
  tenantId: string;
  saasId: string | null;
  mode: SocialContextMode;
  allowDemoFallback: boolean;
  demoTenantId?: string;
  db?: D1Database;
  env?: DracoEnv | null;
};

export class SocialContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SocialContextError";
  }
}

const FALLBACK_ERROR_PATTERNS = ["no such table", "no such column"];

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

function shouldFallbackToDemo(error: unknown, ctx: SocialContext): boolean {
  if (ctx.mode !== "d1" || !ctx.allowDemoFallback) return false;
  const message = (error instanceof Error ? error.message : `${error ?? ""}`).toLowerCase();
  return FALLBACK_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
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

function parseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function serializeJson(input: Record<string, unknown> | unknown[] | null | undefined): string | null {
  if (!input) return null;
  try {
    return JSON.stringify(input);
  } catch {
    return null;
  }
}

function requireSaasId(ctx: SocialContext): string {
  const saasId = ctx.saasId?.trim();
  if (!saasId) {
    throw new SocialContextError("saasId is required for social operations.");
  }
  return saasId;
}

async function queryAllWithCtx<T>(ctx: SocialContext, sql: string, ...params: unknown[]): Promise<T[]> {
  if (ctx.mode !== "d1") return [];
  const db = ctx.db ?? resolveEnvOverride(ctx.env)?.DRACO_DB;
  if (!db) return [];
  const stmt = db.prepare(sql);
  const bound = params.length ? stmt.bind(...params) : stmt;
  const res = await bound.all<T>();
  return res.results ?? [];
}

async function runWithCtx(ctx: SocialContext, sql: string, ...params: unknown[]): Promise<boolean> {
  if (ctx.mode !== "d1") return false;
  const db = ctx.db ?? resolveEnvOverride(ctx.env)?.DRACO_DB;
  if (!db) return false;
  const stmt = db.prepare(sql);
  const bound = params.length ? stmt.bind(...params) : stmt;
  const res = await bound.run();
  return Boolean(res?.success);
}

export async function resolveSocialContext({
  tenantId,
  saasId,
  env,
}: {
  tenantId: string;
  saasId?: string | null;
  env?: DracoEnv | null;
}): Promise<SocialContext> {
  const normalizedSaasId = saasId?.trim() ?? null;
  const demoEnabled = isDemoFeatureEnabled(tenantId, env);

  if (hasDatabase(env)) {
    const runtimeEnv = resolveEnvOverride(env);
    return {
      tenantId,
      saasId: normalizedSaasId,
      mode: "d1",
      allowDemoFallback: demoEnabled,
      demoTenantId: demoEnabled ? DEMO_TENANT_ID : undefined,
      db: runtimeEnv?.DRACO_DB,
      env: runtimeEnv,
    };
  }

  if (!demoEnabled) {
    throw new SocialContextError("Social module is not enabled for this tenant");
  }

  return {
    tenantId,
    saasId: normalizedSaasId,
    mode: "demo",
    allowDemoFallback: true,
    demoTenantId: DEMO_TENANT_ID,
    env,
  };
}

type SocialAccountRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  provider: string;
  handle: string | null;
  display_name: string | null;
  status: string;
  auth_meta: string | null;
  primary: number;
  created_at: string;
  updated_at: string;
};

type SocialCampaignRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  name: string;
  objective: string;
  status: string;
  target_segment: string;
  start_date: string | null;
  end_date: string | null;
  budget_estimate: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type SocialPostRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  campaign_id: string | null;
  provider: string;
  content_type: string;
  title: string;
  body: string;
  image_hint: string | null;
  status: string;
  scheduled_at: string | null;
  posted_at: string | null;
  external_post_id: string | null;
  metadata: string | null;
  created_at: string;
  updated_at: string;
};

type SocialMetricsRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  post_id: string;
  provider: string;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
  leads_generated: number;
  captured_at: string;
  metadata: string | null;
};

function mapAccountRow(row: SocialAccountRow): SaasSocialAccount {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    provider: row.provider as SaasSocialProvider,
    handle: row.handle,
    displayName: row.display_name,
    status: row.status as SaasSocialAccount["status"],
    authMeta: parseJson<Record<string, unknown>>(row.auth_meta),
    isPrimary: row.primary === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCampaignRow(row: SocialCampaignRow): SaasSocialCampaign {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    name: row.name,
    objective: row.objective,
    status: row.status as SaasSocialCampaign["status"],
    targetSegment: row.target_segment,
    startDate: row.start_date,
    endDate: row.end_date,
    budgetEstimate: row.budget_estimate,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPostRow(row: SocialPostRow): SaasSocialPost {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    campaignId: row.campaign_id,
    provider: row.provider as SaasSocialProvider,
    contentType: row.content_type as SaasSocialPost["contentType"],
    title: row.title,
    body: row.body,
    imageHint: row.image_hint,
    status: row.status as SaasSocialPost["status"],
    scheduledAt: row.scheduled_at,
    postedAt: row.posted_at,
    externalPostId: row.external_post_id,
    metadata: parseJson<Record<string, unknown>>(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMetricsRow(row: SocialMetricsRow): SaasSocialMetrics {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    postId: row.post_id,
    provider: row.provider as SaasSocialProvider,
    impressions: row.impressions,
    likes: row.likes,
    comments: row.comments,
    shares: row.shares,
    clicks: row.clicks,
    leadsGenerated: row.leads_generated,
    capturedAt: row.captured_at,
    metadata: parseJson<Record<string, unknown>>(row.metadata),
  };
}

function demoTenantId(ctx: SocialContext): string {
  return ctx.demoTenantId ?? ctx.tenantId;
}

export async function listSaasSocialAccounts(ctx: SocialContext): Promise<SaasSocialAccount[]> {
  const saasId = requireSaasId(ctx);
  if (ctx.mode === "demo") {
    return listDemoSaasSocialAccounts(demoTenantId(ctx), saasId).map(mapAccountRow);
  }
  try {
    const rows = await queryAllWithCtx<SocialAccountRow>(
      ctx,
      `SELECT id, tenant_id, saas_id, provider, handle, display_name, status, auth_meta, primary, created_at, updated_at
       FROM saas_social_accounts
       WHERE tenant_id = ? AND saas_id = ?
       ORDER BY created_at DESC`,
      ctx.tenantId,
      saasId,
    );
    return rows.map(mapAccountRow);
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      return listDemoSaasSocialAccounts(demoTenantId(ctx), saasId).map(mapAccountRow);
    }
    throw error;
  }
}

export async function upsertSaasSocialAccount(
  ctx: SocialContext,
  input: Omit<SaasSocialAccount, "id" | "tenantId" | "createdAt" | "updatedAt" | "isPrimary" | "authMeta"> & {
    id?: string;
    authMeta?: Record<string, unknown> | null;
    isPrimary?: boolean;
  },
): Promise<SaasSocialAccount> {
  const saasId = input.saasId?.trim() ?? requireSaasId(ctx);
  const now = new Date().toISOString();
  const id = input.id?.trim() ?? generateUuid();
  if (ctx.mode === "demo") {
    const record = upsertDemoSaasSocialAccount(demoTenantId(ctx), {
      id,
      saas_id: saasId,
      provider: input.provider,
      handle: input.handle ?? null,
      display_name: input.displayName ?? null,
      status: input.status,
      auth_meta: serializeJson(input.authMeta),
      primary: input.isPrimary ? 1 : 0,
    });
    return mapAccountRow(record);
  }
  try {
    await runWithCtx(
      ctx,
      `INSERT INTO saas_social_accounts (id, tenant_id, saas_id, provider, handle, display_name, status, auth_meta, primary, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         provider = excluded.provider,
         handle = excluded.handle,
         display_name = excluded.display_name,
         status = excluded.status,
         auth_meta = excluded.auth_meta,
         primary = excluded.primary,
         updated_at = excluded.updated_at`,
      id,
      ctx.tenantId,
      saasId,
      input.provider,
      input.handle ?? null,
      input.displayName ?? null,
      input.status,
      serializeJson(input.authMeta),
      input.isPrimary ? 1 : 0,
      now,
      now,
    );
    const rows = await queryAllWithCtx<SocialAccountRow>(
      ctx,
      `SELECT id, tenant_id, saas_id, provider, handle, display_name, status, auth_meta, primary, created_at, updated_at
       FROM saas_social_accounts
       WHERE id = ? LIMIT 1`,
      id,
    );
    return mapAccountRow(rows[0]);
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      const record = upsertDemoSaasSocialAccount(demoTenantId(ctx), {
        id,
        saas_id: saasId,
        provider: input.provider,
        handle: input.handle ?? null,
        display_name: input.displayName ?? null,
        status: input.status,
        auth_meta: serializeJson(input.authMeta),
        primary: input.isPrimary ? 1 : 0,
      });
      return mapAccountRow(record);
    }
    throw error;
  }
}

export async function listSaasSocialCampaigns(ctx: SocialContext): Promise<SaasSocialCampaign[]> {
  const saasId = requireSaasId(ctx);
  if (ctx.mode === "demo") {
    return listDemoSaasSocialCampaigns(demoTenantId(ctx), saasId).map(mapCampaignRow);
  }
  try {
    const rows = await queryAllWithCtx<SocialCampaignRow>(
      ctx,
      `SELECT id, tenant_id, saas_id, name, objective, status, target_segment, start_date, end_date, budget_estimate, notes, created_at, updated_at
       FROM saas_social_campaigns
       WHERE tenant_id = ? AND saas_id = ?
       ORDER BY created_at DESC`,
      ctx.tenantId,
      saasId,
    );
    return rows.map(mapCampaignRow);
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      return listDemoSaasSocialCampaigns(demoTenantId(ctx), saasId).map(mapCampaignRow);
    }
    throw error;
  }
}

export async function upsertSaasSocialCampaign(
  ctx: SocialContext,
  input: Omit<SaasSocialCampaign, "id" | "tenantId" | "createdAt" | "updatedAt"> & { id?: string },
): Promise<SaasSocialCampaign> {
  const saasId = input.saasId?.trim() ?? requireSaasId(ctx);
  const now = new Date().toISOString();
  const id = input.id?.trim() ?? generateUuid();
  if (ctx.mode === "demo") {
    const record = upsertDemoSaasSocialCampaign(demoTenantId(ctx), {
      id,
      saas_id: saasId,
      name: input.name,
      objective: input.objective,
      status: input.status,
      target_segment: input.targetSegment,
      start_date: input.startDate ?? null,
      end_date: input.endDate ?? null,
      budget_estimate: input.budgetEstimate ?? null,
      notes: input.notes ?? null,
    });
    return mapCampaignRow(record);
  }
  try {
    await runWithCtx(
      ctx,
      `INSERT INTO saas_social_campaigns (
         id, tenant_id, saas_id, name, objective, status, target_segment, start_date, end_date, budget_estimate, notes, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         objective = excluded.objective,
         status = excluded.status,
         target_segment = excluded.target_segment,
         start_date = excluded.start_date,
         end_date = excluded.end_date,
         budget_estimate = excluded.budget_estimate,
         notes = excluded.notes,
         updated_at = excluded.updated_at`,
      id,
      ctx.tenantId,
      saasId,
      input.name,
      input.objective,
      input.status,
      input.targetSegment,
      input.startDate ?? null,
      input.endDate ?? null,
      input.budgetEstimate ?? null,
      input.notes ?? null,
      now,
      now,
    );
    const rows = await queryAllWithCtx<SocialCampaignRow>(
      ctx,
      `SELECT id, tenant_id, saas_id, name, objective, status, target_segment, start_date, end_date, budget_estimate, notes, created_at, updated_at
       FROM saas_social_campaigns
       WHERE id = ? LIMIT 1`,
      id,
    );
    return mapCampaignRow(rows[0]);
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      const record = upsertDemoSaasSocialCampaign(demoTenantId(ctx), {
        id,
        saas_id: saasId,
        name: input.name,
        objective: input.objective,
        status: input.status,
        target_segment: input.targetSegment,
        start_date: input.startDate ?? null,
        end_date: input.endDate ?? null,
        budget_estimate: input.budgetEstimate ?? null,
        notes: input.notes ?? null,
      });
      return mapCampaignRow(record);
    }
    throw error;
  }
}

export async function listSaasSocialPosts(
  ctx: SocialContext,
  filters?: { campaignId?: string | null; status?: string | null; provider?: SaasSocialProvider | null },
): Promise<SaasSocialPost[]> {
  const saasId = requireSaasId(ctx);
  if (ctx.mode === "demo") {
    return listDemoSaasSocialPosts(demoTenantId(ctx), saasId, {
      campaignId: filters?.campaignId ?? null,
      status: filters?.status ?? null,
      provider: filters?.provider ?? null,
    }).map(mapPostRow);
  }
  try {
    const clauses = ["tenant_id = ?", "saas_id = ?"];
    const params: unknown[] = [ctx.tenantId, saasId];
    if (filters?.campaignId) {
      clauses.push("campaign_id = ?");
      params.push(filters.campaignId);
    }
    if (filters?.status) {
      clauses.push("status = ?");
      params.push(filters.status);
    }
    if (filters?.provider) {
      clauses.push("provider = ?");
      params.push(filters.provider);
    }
    const rows = await queryAllWithCtx<SocialPostRow>(
      ctx,
      `SELECT id, tenant_id, saas_id, campaign_id, provider, content_type, title, body, image_hint, status,
              scheduled_at, posted_at, external_post_id, metadata, created_at, updated_at
       FROM saas_social_posts
       WHERE ${clauses.join(" AND ")}
       ORDER BY datetime(created_at) DESC`,
      ...params,
    );
    return rows.map(mapPostRow);
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      return listDemoSaasSocialPosts(demoTenantId(ctx), saasId, {
        campaignId: filters?.campaignId ?? null,
        status: filters?.status ?? null,
        provider: filters?.provider ?? null,
      }).map(mapPostRow);
    }
    throw error;
  }
}

export async function getSaasSocialPostById(ctx: SocialContext, postId: string): Promise<SaasSocialPost | null> {
  if (ctx.mode === "demo") {
    const record = getDemoSaasSocialPostById(demoTenantId(ctx), postId);
    return record ? mapPostRow(record) : null;
  }
  try {
    const rows = await queryAllWithCtx<SocialPostRow>(
      ctx,
      `SELECT id, tenant_id, saas_id, campaign_id, provider, content_type, title, body, image_hint, status,
              scheduled_at, posted_at, external_post_id, metadata, created_at, updated_at
       FROM saas_social_posts
       WHERE tenant_id = ? AND id = ? LIMIT 1`,
      ctx.tenantId,
      postId,
    );
    return rows.length ? mapPostRow(rows[0]) : null;
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      const record = getDemoSaasSocialPostById(demoTenantId(ctx), postId);
      return record ? mapPostRow(record) : null;
    }
    throw error;
  }
}

export async function updateSaasSocialPostStatus(
  ctx: SocialContext,
  input: { id: string; status: SaasSocialPost["status"]; postedAt?: string | null },
): Promise<SaasSocialPost | null> {
  const now = new Date().toISOString();
  const postedAt = input.status === "POSTED" ? input.postedAt ?? now : null;
  if (ctx.mode === "demo") {
    const record = updateDemoSaasSocialPostStatus(demoTenantId(ctx), {
      id: input.id,
      status: input.status,
      posted_at: postedAt,
    });
    return record ? mapPostRow(record) : null;
  }
  try {
    await runWithCtx(
      ctx,
      `UPDATE saas_social_posts
       SET status = ?, posted_at = COALESCE(?, posted_at), updated_at = ?
       WHERE tenant_id = ? AND id = ?`,
      input.status,
      postedAt,
      now,
      ctx.tenantId,
      input.id,
    );
    const rows = await queryAllWithCtx<SocialPostRow>(
      ctx,
      `SELECT id, tenant_id, saas_id, campaign_id, provider, content_type, title, body, image_hint, status,
              scheduled_at, posted_at, external_post_id, metadata, created_at, updated_at
       FROM saas_social_posts
       WHERE tenant_id = ? AND id = ? LIMIT 1`,
      ctx.tenantId,
      input.id,
    );
    return rows.length ? mapPostRow(rows[0]) : null;
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      const record = updateDemoSaasSocialPostStatus(demoTenantId(ctx), {
        id: input.id,
        status: input.status,
        posted_at: postedAt,
      });
      return record ? mapPostRow(record) : null;
    }
    throw error;
  }
}

export async function upsertSaasSocialPost(
  ctx: SocialContext,
  input: Omit<SaasSocialPost, "id" | "tenantId" | "createdAt" | "updatedAt"> & { id?: string },
): Promise<SaasSocialPost> {
  const saasId = input.saasId?.trim() ?? requireSaasId(ctx);
  const now = new Date().toISOString();
  const id = input.id?.trim() ?? generateUuid();
  if (ctx.mode === "demo") {
    const record = upsertDemoSaasSocialPost(demoTenantId(ctx), {
      id,
      saas_id: saasId,
      campaign_id: input.campaignId ?? null,
      provider: input.provider,
      content_type: input.contentType,
      title: input.title,
      body: input.body,
      image_hint: input.imageHint ?? null,
      status: input.status,
      scheduled_at: input.scheduledAt ?? null,
      posted_at: input.postedAt ?? null,
      external_post_id: input.externalPostId ?? null,
      metadata: serializeJson(input.metadata),
    });
    return mapPostRow(record);
  }
  try {
    await runWithCtx(
      ctx,
      `INSERT INTO saas_social_posts (
         id, tenant_id, saas_id, campaign_id, provider, content_type, title, body, image_hint, status,
         scheduled_at, posted_at, external_post_id, metadata, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         campaign_id = excluded.campaign_id,
         provider = excluded.provider,
         content_type = excluded.content_type,
         title = excluded.title,
         body = excluded.body,
         image_hint = excluded.image_hint,
         status = excluded.status,
         scheduled_at = excluded.scheduled_at,
         posted_at = excluded.posted_at,
         external_post_id = excluded.external_post_id,
         metadata = excluded.metadata,
         updated_at = excluded.updated_at`,
      id,
      ctx.tenantId,
      saasId,
      input.campaignId ?? null,
      input.provider,
      input.contentType,
      input.title,
      input.body,
      input.imageHint ?? null,
      input.status,
      input.scheduledAt ?? null,
      input.postedAt ?? null,
      input.externalPostId ?? null,
      serializeJson(input.metadata),
      now,
      now,
    );
    const rows = await queryAllWithCtx<SocialPostRow>(
      ctx,
      `SELECT id, tenant_id, saas_id, campaign_id, provider, content_type, title, body, image_hint, status,
              scheduled_at, posted_at, external_post_id, metadata, created_at, updated_at
       FROM saas_social_posts
       WHERE id = ? LIMIT 1`,
      id,
    );
    return mapPostRow(rows[0]);
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      const record = upsertDemoSaasSocialPost(demoTenantId(ctx), {
        id,
        saas_id: saasId,
        campaign_id: input.campaignId ?? null,
        provider: input.provider,
        content_type: input.contentType,
        title: input.title,
        body: input.body,
        image_hint: input.imageHint ?? null,
        status: input.status,
        scheduled_at: input.scheduledAt ?? null,
        posted_at: input.postedAt ?? null,
        external_post_id: input.externalPostId ?? null,
        metadata: serializeJson(input.metadata),
      });
      return mapPostRow(record);
    }
    throw error;
  }
}

export async function listSaasSocialMetricsForPost(ctx: SocialContext, postId: string): Promise<SaasSocialMetrics[]> {
  if (ctx.mode === "demo") {
    return listDemoSaasSocialMetricsForPost(demoTenantId(ctx), postId).map(mapMetricsRow);
  }
  try {
    const rows = await queryAllWithCtx<SocialMetricsRow>(
      ctx,
      `SELECT id, tenant_id, saas_id, post_id, provider, impressions, likes, comments, shares, clicks, leads_generated, captured_at, metadata
       FROM saas_social_metrics
       WHERE tenant_id = ? AND post_id = ?
       ORDER BY datetime(captured_at) DESC`,
      ctx.tenantId,
      postId,
    );
    return rows.map(mapMetricsRow);
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      return listDemoSaasSocialMetricsForPost(demoTenantId(ctx), postId).map(mapMetricsRow);
    }
    throw error;
  }
}

export async function getSocialOverview(ctx: SocialContext): Promise<{
  connectedAccounts: number;
  activeCampaigns: number;
  scheduledThisWeek: number;
  engagementLast30Days: number;
}> {
  const [accounts, campaigns, posts] = await Promise.all([
    listSaasSocialAccounts(ctx),
    listSaasSocialCampaigns(ctx),
    listSaasSocialPosts(ctx),
  ]);
  const connectedAccounts = accounts.filter((account) => account.status !== "DISCONNECTED").length;
  const activeCampaigns = campaigns.filter((campaign) => campaign.status === "ACTIVE").length;
  const now = Date.now();
  const weekAhead = now + 7 * 24 * 60 * 60 * 1000;
  const scheduledThisWeek = posts.filter((post) => {
    if (post.status !== "SCHEDULED" || !post.scheduledAt) return false;
    const ts = new Date(post.scheduledAt).getTime();
    return ts >= now && ts <= weekAhead;
  }).length;

  let engagementLast30Days = 0;
  if (ctx.mode === "demo") {
    const demoMetrics = listDemoSaasSocialPosts(demoTenantId(ctx), requireSaasId(ctx)).flatMap((post) =>
      listDemoSaasSocialMetricsForPost(demoTenantId(ctx), post.id),
    );
    const since = now - 30 * 24 * 60 * 60 * 1000;
    engagementLast30Days = demoMetrics
      .filter((metric) => new Date(metric.captured_at).getTime() >= since)
      .reduce((acc, metric) => acc + metric.likes + metric.comments + metric.shares + metric.clicks, 0);
  } else {
    const rows = await queryAllWithCtx<Pick<SocialMetricsRow, "likes" | "comments" | "shares" | "clicks" | "captured_at">>(
      ctx,
      `SELECT likes, comments, shares, clicks, captured_at
       FROM saas_social_metrics
       WHERE tenant_id = ? AND saas_id = ? AND datetime(captured_at) >= datetime(?)`,
      ctx.tenantId,
      requireSaasId(ctx),
      new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString(),
    );
    engagementLast30Days = rows.reduce((acc, row) => acc + row.likes + row.comments + row.shares + row.clicks, 0);
  }

  return { connectedAccounts, activeCampaigns, scheduledThisWeek, engagementLast30Days };
}

function isConversionStatus(status: string): boolean {
  return status !== "CANCELLED" && status !== "NO_SHOW";
}

function estimateAppointmentRevenue(appointment: { status: string; priceAtBooking: number | null }, servicePrice: number): number {
  if (appointment.status !== "DONE") return 0;
  if (typeof appointment.priceAtBooking === "number") return appointment.priceAtBooking;
  return servicePrice;
}

export async function getSocialCampaignPerformance(ctx: SocialContext): Promise<SocialCampaignPerformance[]> {
  const saasId = requireSaasId(ctx);
  const [campaigns, posts] = await Promise.all([listSaasSocialCampaigns(ctx), listSaasSocialPosts(ctx)]);
  const appointments = await listAppointmentsForSaas(await resolveAppointmentsContext({ tenantId: ctx.tenantId, saasId, env: ctx.env }));
  const economyCtx = await resolveEconomyContext({ tenantId: ctx.tenantId, saasId, env: ctx.env }).catch(() => null);
  const services = economyCtx ? await listSaasServices(economyCtx).catch(() => []) : [];
  const servicePriceById = new Map(services.map((service) => [service.id, service.currentPrice]));

  return campaigns.map((campaign) => {
    const campaignPosts = posts.filter((post) => post.campaignId === campaign.id);
    const attributed = appointments.filter((appt) => appt.socialCampaignId === campaign.id && isConversionStatus(appt.status));
    const estimatedRevenue = attributed.reduce((acc, appt) => {
      const servicePrice = servicePriceById.get(appt.serviceId) ?? 0;
      return acc + estimateAppointmentRevenue(appt, servicePrice);
    }, 0);
    const provider = campaignPosts[0]?.provider ?? "OTHER";
    return {
      campaignId: campaign.id,
      name: campaign.name,
      provider,
      postsCount: campaignPosts.length,
      appointmentsCount: attributed.length,
      estimatedRevenue,
    };
  });
}

export async function getSocialPostPerformance(ctx: SocialContext): Promise<SocialPostPerformance[]> {
  const saasId = requireSaasId(ctx);
  const posts = await listSaasSocialPosts(ctx);
  const appointments = await listAppointmentsForSaas(await resolveAppointmentsContext({ tenantId: ctx.tenantId, saasId, env: ctx.env }));
  const economyCtx = await resolveEconomyContext({ tenantId: ctx.tenantId, saasId, env: ctx.env }).catch(() => null);
  const services = economyCtx ? await listSaasServices(economyCtx).catch(() => []) : [];
  const servicePriceById = new Map(services.map((service) => [service.id, service.currentPrice]));

  return posts.map((post) => {
    const attributed = appointments.filter((appt) => appt.socialPostId === post.id && isConversionStatus(appt.status));
    const estimatedRevenue = attributed.reduce((acc, appt) => {
      const servicePrice = servicePriceById.get(appt.serviceId) ?? 0;
      return acc + estimateAppointmentRevenue(appt, servicePrice);
    }, 0);
    return {
      postId: post.id,
      campaignId: post.campaignId ?? undefined,
      provider: post.provider,
      title: post.title,
      scheduledAt: post.scheduledAt,
      status: post.status,
      appointmentsCount: attributed.length,
      estimatedRevenue,
    };
  });
}

export async function getSocialConversionSnapshot(ctx: SocialContext): Promise<SocialConversionSnapshot> {
  const [campaigns, posts] = await Promise.all([getSocialCampaignPerformance(ctx), getSocialPostPerformance(ctx)]);
  const totalAppointmentsFromSocial = campaigns.reduce((acc, item) => acc + item.appointmentsCount, 0);
  const totalRevenueFromSocial = campaigns.reduce((acc, item) => acc + item.estimatedRevenue, 0);
  const topCampaigns = [...campaigns].sort((a, b) => b.estimatedRevenue - a.estimatedRevenue).slice(0, 4);
  const topPosts = [...posts].sort((a, b) => b.estimatedRevenue - a.estimatedRevenue).slice(0, 6);
  return { totalAppointmentsFromSocial, totalRevenueFromSocial, topCampaigns, topPosts };
}

export type SocialOwnerSummary = {
  accountsConnected: number;
  activeCampaigns: number;
  scheduledPostsThisWeek: number;
  recentEngagementScore: number;
};

export async function getSocialOwnerSummary(ctx: SocialContext): Promise<SocialOwnerSummary> {
  const [accounts, campaigns, posts] = await Promise.all([
    listSaasSocialAccounts(ctx),
    listSaasSocialCampaigns(ctx),
    listSaasSocialPosts(ctx),
  ]);
  const accountsConnected = accounts.filter((account) => account.status !== "DISCONNECTED").length;
  const activeCampaigns = campaigns.filter((campaign) => campaign.status === "ACTIVE").length;
  const now = Date.now();
  const weekAhead = now + 7 * 24 * 60 * 60 * 1000;
  const scheduledPostsThisWeek = posts.filter((post) => {
    if (post.status !== "SCHEDULED" || !post.scheduledAt) return false;
    const ts = new Date(post.scheduledAt).getTime();
    return ts >= now && ts <= weekAhead;
  }).length;

  let recentEngagementScore = 0;
  if (ctx.mode === "demo") {
    const demoMetrics = listDemoSaasSocialPosts(demoTenantId(ctx), requireSaasId(ctx)).flatMap((post) =>
      listDemoSaasSocialMetricsForPost(demoTenantId(ctx), post.id),
    );
    recentEngagementScore = demoMetrics.reduce((acc, metric) => acc + metric.likes + metric.comments + metric.shares, 0);
  } else {
    const rows = await queryAllWithCtx<Pick<SocialMetricsRow, "likes" | "comments" | "shares">>(
      ctx,
      `SELECT likes, comments, shares
       FROM saas_social_metrics
       WHERE tenant_id = ? AND saas_id = ? AND datetime(captured_at) >= datetime(?)`,
      ctx.tenantId,
      requireSaasId(ctx),
      new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString(),
    );
    recentEngagementScore = rows.reduce((acc, row) => acc + row.likes + row.comments + row.shares, 0);
  }

  return { accountsConnected, activeCampaigns, scheduledPostsThisWeek, recentEngagementScore };
}
