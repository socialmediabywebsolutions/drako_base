import { DatabaseUnavailableError, ensureDracoDb, ensureSocialDb, queryAll, queryOne, run, runDetailed } from "../db/runtime-db";
import type { RuntimeChannelProfile, RuntimeSocialAccount, RuntimeSocialCampaign, RuntimeSocialPost, RuntimeSocialProvider } from "./contracts";

type SocialAccountRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  provider: string;
  handle: string | null;
  display_name: string | null;
  status: string;
  auth_meta: string | null;
  is_primary?: number;
  primary?: number;
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
  channel_id: string | null;
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

type ChannelRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  name: string;
  provider: string;
  status: string;
  created_at: string;
  updated_at: string;
};

type ProfileStoreRow = {
  tenant_id: string;
  saas_id: string;
  channel_id: string;
  payload_json: string;
  created_at: string;
  updated_at: string;
};

type SaasSeedRow = {
  id: string;
  slug: string;
  name: string;
  blueprint_snapshot: string | null;
};

const CHANNEL_PROFILE_TABLE = "socialflow_runtime_channel_profiles";
const CHANNEL_COMPETITORS_TABLE = "socialflow_runtime_channel_competitors";
const CHANNEL_ASSETS_TABLE = "socialflow_runtime_channel_assets";
const SOCIALFLOW_EXPORT_SLUGS = ["socialflow", "socialflows"] as const;
const DEFAULT_PROFILE_CHANNEL_NAME = "LinkedIn";
const schemaInitCache = new WeakMap<D1Database, Promise<void>>();

export class SocialContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SocialContextError";
  }
}

export type RuntimeSocialContext = {
  tenantId: string;
  saasId: string;
  socialDb: D1Database;
  dracoDb: D1Database | null;
};

export function nowIso() {
  return new Date().toISOString();
}

export function generateRuntimeId(prefix: string) {
  try {
    return `${prefix}_${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(16).slice(2)}`;
  } catch {
    return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
}

export function parseJsonRecord(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

export function serializeJsonRecord(value: Record<string, unknown> | null | undefined) {
  return value == null ? null : JSON.stringify(value);
}

export function mergeJsonRecord(base: Record<string, unknown> | null, patch: Record<string, unknown>) {
  return { ...(base ?? {}), ...patch };
}

function normalizeSaasId(value: string | null | undefined) {
  const next = value?.trim();
  if (!next) {
    throw new SocialContextError("saasId is required for SocialFlow runtime operations.");
  }
  return next;
}

async function ensurePostsChannelColumn(db: D1Database) {
  const columns = await queryAll<{ name: string }>(db, "PRAGMA table_info('saas_social_posts')");
  if (!columns.some((column) => column.name === "channel_id")) {
    await run(db, "ALTER TABLE saas_social_posts ADD COLUMN channel_id TEXT");
  }
}

export async function ensureRuntimeSocialSchema(db: D1Database) {
  const cached = schemaInitCache.get(db);
  if (cached) {
    await cached;
    return;
  }

  const promise = (async () => {
    await run(db, `CREATE TABLE IF NOT EXISTS saas_social_accounts (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, saas_id TEXT NOT NULL, provider TEXT NOT NULL, handle TEXT, display_name TEXT, status TEXT NOT NULL, auth_meta TEXT, is_primary INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`);
    await run(db, `CREATE TABLE IF NOT EXISTS saas_social_channels (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, saas_id TEXT NOT NULL, name TEXT NOT NULL, provider TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`);
    await run(db, `CREATE TABLE IF NOT EXISTS saas_social_campaigns (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, saas_id TEXT NOT NULL, name TEXT NOT NULL, objective TEXT NOT NULL, status TEXT NOT NULL, target_segment TEXT NOT NULL, start_date TEXT, end_date TEXT, budget_estimate REAL, notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`);
    await run(db, `CREATE TABLE IF NOT EXISTS saas_social_posts (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, saas_id TEXT NOT NULL, channel_id TEXT, campaign_id TEXT, provider TEXT NOT NULL, content_type TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, image_hint TEXT, status TEXT NOT NULL, scheduled_at TEXT, posted_at TEXT, external_post_id TEXT, metadata TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`);
    await ensurePostsChannelColumn(db);
    await run(db, `CREATE TABLE IF NOT EXISTS ${CHANNEL_PROFILE_TABLE} (tenant_id TEXT NOT NULL, saas_id TEXT NOT NULL, channel_id TEXT NOT NULL, payload_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (tenant_id, saas_id, channel_id))`);
    await run(db, `CREATE TABLE IF NOT EXISTS ${CHANNEL_COMPETITORS_TABLE} (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, saas_id TEXT NOT NULL, channel_id TEXT NOT NULL, payload_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`);
    await run(db, `CREATE TABLE IF NOT EXISTS ${CHANNEL_ASSETS_TABLE} (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, saas_id TEXT NOT NULL, channel_id TEXT NOT NULL, payload_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`);
    await run(db, "CREATE INDEX IF NOT EXISTS idx_runtime_social_accounts_workspace ON saas_social_accounts (tenant_id, saas_id, provider)");
    await run(db, "CREATE INDEX IF NOT EXISTS idx_runtime_social_channels_workspace ON saas_social_channels (tenant_id, saas_id, provider)");
    await run(db, "CREATE INDEX IF NOT EXISTS idx_runtime_social_campaigns_workspace ON saas_social_campaigns (tenant_id, saas_id, status)");
    await run(db, "CREATE INDEX IF NOT EXISTS idx_runtime_social_posts_workspace ON saas_social_posts (tenant_id, saas_id, status)");
    await run(db, `CREATE INDEX IF NOT EXISTS idx_${CHANNEL_COMPETITORS_TABLE}_workspace ON ${CHANNEL_COMPETITORS_TABLE} (tenant_id, saas_id, channel_id)`);
    await run(db, `CREATE INDEX IF NOT EXISTS idx_${CHANNEL_ASSETS_TABLE}_workspace ON ${CHANNEL_ASSETS_TABLE} (tenant_id, saas_id, channel_id)`);
  })();

  schemaInitCache.set(db, promise);

  try {
    await promise;
  } catch (error) {
    schemaInitCache.delete(db);
    throw error;
  }
}

export async function resolveRuntimeSocialContext(input: { tenantId: string; saasId: string }) {
  const tenantId = input.tenantId.trim();
  if (!tenantId) {
    throw new SocialContextError("tenantId is required for SocialFlow runtime operations.");
  }

  const socialDb = ensureSocialDb();
  await ensureRuntimeSocialSchema(socialDb);

  let dracoDb: D1Database | null = null;
  try {
    dracoDb = ensureDracoDb();
  } catch (error) {
    if (!(error instanceof DatabaseUnavailableError)) {
      throw error;
    }
  }

  return {
    tenantId,
    saasId: normalizeSaasId(input.saasId),
    socialDb,
    dracoDb,
  } satisfies RuntimeSocialContext;
}

export function mapSocialAccountRow(row: SocialAccountRow): RuntimeSocialAccount {
  const primary = typeof row.is_primary === "number" ? row.is_primary : (row.primary ?? 0);
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    provider: row.provider as RuntimeSocialProvider,
    handle: row.handle,
    displayName: row.display_name,
    status: row.status,
    authMeta: parseJsonRecord(row.auth_meta),
    isPrimary: primary === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapSocialCampaignRow(row: SocialCampaignRow): RuntimeSocialCampaign {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    name: row.name,
    objective: row.objective,
    status: row.status as RuntimeSocialCampaign["status"],
    targetSegment: row.target_segment,
    startDate: row.start_date,
    endDate: row.end_date,
    budgetEstimate: row.budget_estimate,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapSocialPostRow(row: SocialPostRow): RuntimeSocialPost {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    channelId: row.channel_id,
    campaignId: row.campaign_id,
    provider: row.provider as RuntimeSocialProvider,
    contentType: row.content_type as RuntimeSocialPost["contentType"],
    title: row.title,
    body: row.body,
    imageHint: row.image_hint,
    status: row.status as RuntimeSocialPost["status"],
    scheduledAt: row.scheduled_at,
    postedAt: row.posted_at,
    externalPostId: row.external_post_id,
    metadata: parseJsonRecord(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listRuntimeSocialAccounts(context: RuntimeSocialContext) {
  const rows = await queryAll<SocialAccountRow>(
    context.socialDb,
    `SELECT id, tenant_id, saas_id, provider, handle, display_name, status, auth_meta, is_primary, created_at, updated_at
     FROM saas_social_accounts
     WHERE tenant_id = ? AND saas_id = ?
     ORDER BY is_primary DESC, datetime(updated_at) DESC`,
    context.tenantId,
    context.saasId,
  );
  return rows.map(mapSocialAccountRow);
}

export async function ensureRuntimeChannelForProvider(context: RuntimeSocialContext, provider: RuntimeSocialProvider) {
  const existing = await queryOne<ChannelRow>(
    context.socialDb,
    `SELECT id, tenant_id, saas_id, name, provider, status, created_at, updated_at
     FROM saas_social_channels
     WHERE tenant_id = ? AND saas_id = ? AND provider = ?
     ORDER BY datetime(updated_at) DESC
     LIMIT 1`,
    context.tenantId,
    context.saasId,
    provider,
  );

  if (existing) {
    return existing.id;
  }

  const now = nowIso();
  const channelId = generateRuntimeId("sf_channel");
  await run(
    context.socialDb,
    `INSERT INTO saas_social_channels (id, tenant_id, saas_id, name, provider, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`,
    channelId,
    context.tenantId,
    context.saasId,
    DEFAULT_PROFILE_CHANNEL_NAME,
    provider,
    now,
    now,
  );
  return channelId;
}

export async function ensureRuntimeWorkspaceChannel(context: RuntimeSocialContext) {
  const existing = await queryOne<ChannelRow>(
    context.socialDb,
    `SELECT id, tenant_id, saas_id, name, provider, status, created_at, updated_at
     FROM saas_social_channels
     WHERE tenant_id = ? AND saas_id = ?
     ORDER BY datetime(updated_at) DESC
     LIMIT 1`,
    context.tenantId,
    context.saasId,
  );

  if (existing) {
    return existing.id;
  }

  return ensureRuntimeChannelForProvider(context, "LINKEDIN");
}

export async function resolveRuntimeSocialSaasSeed(tenantId: string): Promise<SaasSeedRow | null> {
  let db: D1Database;
  try {
    db = ensureDracoDb();
  } catch {
    return null;
  }

  return queryOne<SaasSeedRow>(
    db,
    `SELECT id, slug, name, blueprint_snapshot
     FROM saas
     WHERE tenant_id = ? AND lower(slug) IN (?, ?)
     ORDER BY datetime(created_at) DESC
     LIMIT 1`,
    tenantId,
    SOCIALFLOW_EXPORT_SLUGS[0],
    SOCIALFLOW_EXPORT_SLUGS[1],
  );
}

export async function listRuntimeProfileStoreRows(context: RuntimeSocialContext, tableName: typeof CHANNEL_COMPETITORS_TABLE | typeof CHANNEL_ASSETS_TABLE) {
  return queryAll<ProfileStoreRow>(
    context.socialDb,
    `SELECT tenant_id, saas_id, channel_id, payload_json, created_at, updated_at
     FROM ${tableName}
     WHERE tenant_id = ? AND saas_id = ?
     ORDER BY datetime(updated_at) DESC`,
    context.tenantId,
    context.saasId,
  );
}

export async function getRuntimeProfileStoreRow(context: RuntimeSocialContext, channelId: string) {
  return queryOne<ProfileStoreRow>(
    context.socialDb,
    `SELECT tenant_id, saas_id, channel_id, payload_json, created_at, updated_at
     FROM ${CHANNEL_PROFILE_TABLE}
     WHERE tenant_id = ? AND saas_id = ? AND channel_id = ?
     LIMIT 1`,
    context.tenantId,
    context.saasId,
    channelId,
  );
}

export async function upsertRuntimeProfileStoreRow(context: RuntimeSocialContext, channelId: string, profile: RuntimeChannelProfile) {
  const now = nowIso();
  const existing = await getRuntimeProfileStoreRow(context, channelId);
  const createdAt = existing?.created_at ?? now;

  await run(
    context.socialDb,
    `INSERT INTO ${CHANNEL_PROFILE_TABLE} (tenant_id, saas_id, channel_id, payload_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, saas_id, channel_id) DO UPDATE SET
       payload_json = excluded.payload_json,
       updated_at = excluded.updated_at`,
    context.tenantId,
    context.saasId,
    channelId,
    JSON.stringify(profile),
    createdAt,
    now,
  );
}

export async function upsertRuntimeStoreEntity(
  context: RuntimeSocialContext,
  tableName: typeof CHANNEL_COMPETITORS_TABLE | typeof CHANNEL_ASSETS_TABLE,
  id: string,
  channelId: string,
  payload: Record<string, unknown>,
) {
  const now = nowIso();
  const existing = await queryOne<{ created_at: string }>(
    context.socialDb,
    `SELECT created_at FROM ${tableName} WHERE id = ? AND tenant_id = ? LIMIT 1`,
    id,
    context.tenantId,
  );
  const createdAt = existing?.created_at ?? now;

  await run(
    context.socialDb,
    `INSERT INTO ${tableName} (id, tenant_id, saas_id, channel_id, payload_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       payload_json = excluded.payload_json,
       channel_id = excluded.channel_id,
       updated_at = excluded.updated_at`,
    id,
    context.tenantId,
    context.saasId,
    channelId,
    JSON.stringify(payload),
    createdAt,
    now,
  );
}

export async function claimPublishingSlot(context: RuntimeSocialContext, postId: string) {
  const result = await runDetailed(
    context.socialDb,
    `UPDATE saas_social_posts
     SET status = 'PUBLISHING', updated_at = ?
     WHERE id = ? AND tenant_id = ? AND saas_id = ? AND status = 'SCHEDULED'`,
    nowIso(),
    postId,
    context.tenantId,
    context.saasId,
  );

  return ((result.meta as { changes?: number } | undefined)?.changes ?? 0) > 0;
}
