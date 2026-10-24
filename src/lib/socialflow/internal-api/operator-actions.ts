import type {
  SocialFlowConnectionCheckResult,
  SocialFlowLaunchCampaignResult,
  SocialFlowPostActionResult,
  SocialFlowTenantListItem,
  SocialFlowTestAiReplyResult,
} from "@/lib/capabilities/internal-api-types/socialflow";
import { env } from "@/lib/cf";
import { getCanonicalBillingSnapshot } from "@/lib/billing/subscriptions";
import { getSocialFlowAccountTypeByTenant } from "@/lib/socialflow/auth/account-type";
import { resolveSocialFlowPlanCode } from "@/lib/socialflow/billing/plans";
import { BLOCKED_INTENT_REPLY, detectBlockedIntent } from "@/lib/socialflow/conversational/blocked-intent";
import { generateConversationalReply } from "@/lib/socialflow/conversational/engine";
import type { ConversationThreadType } from "@/lib/socialflow/conversational/types";
import { getKnowledgeContext } from "@/lib/socialflow/knowledge/repository";
import { getChannelKnowledge, getChannelProfile } from "@/lib/socialflow/profile/repository";
import {
  listSaasSocialAccounts,
  listSaasSocialPosts,
  resolveSocialContext,
  schedulePost,
  upsertSaasSocialCampaign,
} from "@/lib/socialflow/repository";
import type { SaasSocialPost } from "@/lib/social-core/types";

// Ejecutores reales de las acciones que el operator del holding pide por el contrato
// interno (P6). Antes vivían en src/app/api/operator/socialflow/route.ts (holding) o
// eran stubs que respondían "queued" sin hacer nada.

const STALE_PUBLISHING_MINUTES = 15;
const MAX_OPERATOR_ACTION_POSTS = 20;

// ── recover_stale_publishing / retry_failed_posts ────────────────────────────────────

function isStalePublishing(post: SaasSocialPost, now: number): boolean {
  if (post.status !== "PUBLISHING") return false;
  const updatedAt = Date.parse(post.updatedAt);
  if (Number.isNaN(updatedAt)) return false;
  return updatedAt < now - STALE_PUBLISHING_MINUTES * 60 * 1000;
}

// Un post con externalPostId ya llegó a la red: reintentarlo lo duplicaría.
function canRetryFailedPost(post: SaasSocialPost): boolean {
  return post.status === "FAILED" && !post.externalPostId;
}

export async function runPostRecoveryAction(input: {
  action: "recover_stale_publishing" | "retry_failed_posts";
  tenantId: string;
  saasId: string;
  now?: number;
}): Promise<SocialFlowPostActionResult> {
  const ctx = await resolveSocialContext({ tenantId: input.tenantId, saasId: input.saasId });
  const now = input.now ?? Date.now();
  const status = input.action === "recover_stale_publishing" ? "PUBLISHING" : "FAILED";
  const posts = await listSaasSocialPosts(ctx, { status });
  const items: SocialFlowPostActionResult["items"] = [];

  for (const post of posts.slice(0, MAX_OPERATOR_ACTION_POSTS)) {
    const eligible = input.action === "recover_stale_publishing"
      ? isStalePublishing(post, now) && !post.externalPostId
      : canRetryFailedPost(post);

    if (!eligible) {
      items.push({
        id: post.id,
        title: post.title,
        previousStatus: post.status,
        nextStatus: null,
        ok: false,
        reason: post.externalPostId ? "EXTERNAL_POST_ID_PRESENT" : "NOT_ELIGIBLE",
      });
      continue;
    }

    const updated = await schedulePost(ctx, { id: post.id, scheduledAt: post.scheduledAt ?? new Date(now).toISOString() });
    items.push({
      id: post.id,
      title: post.title,
      previousStatus: post.status,
      nextStatus: updated?.status ?? null,
      ok: updated?.status === "SCHEDULED",
      reason: updated?.status === "SCHEDULED" ? null : "UPDATE_FAILED",
    });
  }

  const affected = items.filter((item) => item.ok).length;
  const skipped = items.length - affected;
  const message = input.action === "recover_stale_publishing"
    ? affected > 0
      ? `Recovered ${affected} stale PUBLISHING post(s).`
      : `No stale PUBLISHING posts needed recovery.${skipped > 0 ? ` Skipped ${skipped}.` : ""}`
    : affected > 0
      ? `Queued ${affected} failed post(s) for retry.`
      : `No failed posts were eligible for retry.${skipped > 0 ? ` Skipped ${skipped}.` : ""}`;

  return { scanned: posts.length, affected, skipped, items, message };
}

// ── launch_campaign / generate_schedule ──────────────────────────────────────────────

const OPERATOR_CAMPAIGN_DEFAULT_TONE = "profesional y cercano";

function isAiGenerationDisabled(): boolean {
  return ["1", "true", "yes", "on"].includes((process.env.SOCIALFLOW_DISABLE_AI ?? "").trim().toLowerCase());
}

// Mismo job "campaign" que el endpoint de generación de SocialCors, en nombre del tenant
// elegido por el operator. La IA escribe los posts: niche guía el contenido y startDate
// solo aporta el día (la hora la elige SchedulerAgent).
export async function queueOperatorCampaign(input: {
  tenantId: string;
  saasId: string;
  niche: string;
  tone?: string | null;
  frequencyPerWeek?: number;
  startDate?: string | null;
}): Promise<{ campaignId: string }> {
  if (isAiGenerationDisabled()) throw new Error("SOCIALFLOW_AI_GENERATION_DISABLED");
  const queue = env()?.SOCIALFLOW_AI_QUEUE;
  if (!queue) throw new Error("SOCIALFLOW_AI_QUEUE_UNAVAILABLE");

  const ctx = await resolveSocialContext({ tenantId: input.tenantId, saasId: input.saasId });
  const profile = await getChannelProfile(input.tenantId, input.saasId).catch(() => null);
  const campaignId = `ai_campaign_operator_${Date.now()}_${input.tenantId.slice(0, 8)}`;
  const startDate = input.startDate ?? null;

  await upsertSaasSocialCampaign(ctx, {
    id: campaignId,
    saasId: input.saasId,
    name: `AI Campaign: ${input.niche}`,
    objective: null,
    status: "GENERATING",
    targetSegment: "DEFAULT",
    startDate,
    endDate: null,
    budgetEstimate: null,
    notes: null,
  });

  await queue.send({
    type: "campaign",
    tenantId: input.tenantId,
    saasId: input.saasId,
    niche: input.niche,
    tone: input.tone?.trim() || profile?.toneOfVoice?.trim() || OPERATOR_CAMPAIGN_DEFAULT_TONE,
    frequencyPerWeek: input.frequencyPerWeek ?? 1,
    campaignId,
    startDate,
  });

  return { campaignId };
}

export async function launchOperatorCampaign(input: {
  tenants: string[];
  saasId: string;
  title: string;
  scheduledAt: string | null;
}): Promise<SocialFlowLaunchCampaignResult> {
  const startDate = input.scheduledAt ? input.scheduledAt.slice(0, 10) : null;
  const results: SocialFlowLaunchCampaignResult["results"] = [];
  for (const tenantId of input.tenants) {
    try {
      const { campaignId } = await queueOperatorCampaign({ tenantId, saasId: input.saasId, niche: input.title, startDate });
      results.push({ tenantId, ok: true, campaignId });
    } catch (error) {
      results.push({ tenantId, ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return { results };
}

// ── test_ai_reply ────────────────────────────────────────────────────────────────────

// Probador de respuestas IA del operator: mismo motor conversacional del producto, con el
// tenant elegido por el operator. El nicho es editable a propósito y nunca se persiste.
export async function testOperatorAiReply(input: {
  tenantId: string;
  saasId: string;
  message: string;
  threadType: ConversationThreadType;
  provider: string;
  niche?: string;
}): Promise<SocialFlowTestAiReplyResult> {
  if (detectBlockedIntent(input.message)) {
    return { kind: "BLOCKED_INTENT", suggestedReply: BLOCKED_INTENT_REPLY };
  }

  const [knowledge, knowledgeContext] = await Promise.all([
    getChannelKnowledge(input.tenantId, input.saasId),
    getKnowledgeContext(input.tenantId, input.saasId).catch(() => ""),
  ]);
  const profile = input.niche ? { ...knowledge.profile, niche: input.niche } : knowledge.profile;

  const { suggestedReply, aiMetadata } = await generateConversationalReply({
    incomingMessage: input.message,
    threadType: input.threadType,
    provider: input.provider,
    profile,
    knowledge,
    knowledgeContext,
    tenantId: input.tenantId,
    saasId: input.saasId,
  });

  return { kind: "AI_GENERATED", suggestedReply, aiMetadata: (aiMetadata ?? null) as Record<string, unknown> | null };
}

// ── validate_connections (health check del operator) ─────────────────────────────────

const TOKEN_EXPIRY_WARNING_DAYS = 7;

// Chequeo real de las conexiones del tenant (antes el holding devolvía "3 pasados, 0
// fallidos" fijo). Solo lectura: no refresca tokens (eso lo hace el cron de métricas).
export async function checkTenantConnections(input: {
  tenantId: string;
  saasId: string;
  now?: number;
}): Promise<SocialFlowConnectionCheckResult> {
  const ctx = await resolveSocialContext({ tenantId: input.tenantId, saasId: input.saasId });
  const now = input.now ?? Date.now();
  const accounts = await listSaasSocialAccounts(ctx);

  const checked = accounts
    .filter((account) => account.status !== "DISCONNECTED")
    .map((account) => {
      const expiresAt = typeof account.authMeta?.expiresAt === "string" ? account.authMeta.expiresAt : null;
      const expiresAtMs = expiresAt ? Date.parse(expiresAt) : Number.NaN;
      let reason: string | null = null;
      if (account.status !== "CONNECTED_REAL") reason = `STATUS_${account.status}`;
      else if (!Number.isNaN(expiresAtMs) && expiresAtMs <= now) reason = "TOKEN_EXPIRED";
      else if (!Number.isNaN(expiresAtMs) && expiresAtMs - now < TOKEN_EXPIRY_WARNING_DAYS * 86_400_000) reason = "TOKEN_EXPIRING_SOON";
      return { id: account.id, provider: account.provider, status: account.status, expiresAt, ok: reason === null, reason };
    });

  const checksFailed = checked.filter((account) => !account.ok).length;
  const checksPassed = checked.length - checksFailed;
  const recommendedAction = checked.length === 0
    ? "No connected social accounts for this tenant."
    : checksFailed === 0
      ? "All connections are healthy."
      : `Reconnect or refresh: ${checked.filter((account) => !account.ok).map((account) => `${account.provider} (${account.reason})`).join(", ")}.`;

  return { checksPassed, checksFailed, recommendedAction, accounts: checked };
}

// ── tenants ──────────────────────────────────────────────────────────────────────────

type TenantProfileRow = {
  tenant_id: string;
  saas_id: string;
  brand_name: string | null;
  display_name: string | null;
  business_type: string | null;
  contact_email: string | null;
  metadata_json: string | null;
};

// business_type es la columna donde se guarda el nicho; metadata_json.profile.niche solo
// para filas antiguas sin esa columna rellenada.
function parseNicheFromMetadata(metadataJson: string | null): string | null {
  if (!metadataJson) return null;
  try {
    const parsed = JSON.parse(metadataJson) as { profile?: { niche?: unknown } };
    const niche = parsed?.profile?.niche;
    return typeof niche === "string" && niche.trim() ? niche.trim() : null;
  } catch {
    return null;
  }
}

// Mismo criterio que resolvePlanCode() en billing/enforce.ts. Nunca lanza: un fallo de
// billing de un tenant no debe tumbar el listado completo.
async function resolveTenantPlanCode(tenantId: string): Promise<string | null> {
  try {
    const snapshot = await getCanonicalBillingSnapshot({ tenantId, saasSlug: "socialflow" });
    if (!snapshot.isInternalAccount) return resolveSocialFlowPlanCode(snapshot.subscription);
    const accountType = await getSocialFlowAccountTypeByTenant(tenantId);
    return resolveSocialFlowPlanCode(snapshot.subscription, { isInternalAccount: true, accountType });
  } catch {
    return null;
  }
}

// Todos los tenants de SocialCors (socialflow_profiles), no solo los que tienen
// automatización registrada en el holding.
export async function listSocialCorsTenants(db: D1Database): Promise<SocialFlowTenantListItem[]> {
  const { results } = await db
    .prepare(
      `SELECT tenant_id, saas_id, brand_name, display_name, business_type, contact_email, metadata_json
       FROM socialflow_profiles WHERE saas_id = 'socialflow' ORDER BY updated_at DESC`,
    )
    .all<TenantProfileRow>();

  return Promise.all(
    (results ?? []).map(async (row) => {
      const niche = row.business_type?.trim() || parseNicheFromMetadata(row.metadata_json);
      const name = row.brand_name?.trim() || row.display_name?.trim() || row.contact_email?.trim() || row.tenant_id;
      return {
        id: row.tenant_id,
        tenantId: row.tenant_id,
        saasId: row.saas_id,
        name,
        niche: niche || null,
        plan: await resolveTenantPlanCode(row.tenant_id),
      };
    }),
  );
}

// ── ejecuciones recientes de agentes (observabilidad del operator) ───────────────────

type AgentExecutionLogRow = {
  agent_name: string;
  tenant_id: string | null;
  status: string;
  started_at: string;
  finished_at: string | null;
  rows_written: number | null;
  error_message: string | null;
};

// Runs agregados (tenant_id NULL, la mayoría de crons del Cerebro) + los del tenant.
export async function listRecentAgentRuns(db: D1Database, tenantId: string, limit = 10) {
  const { results } = await db
    .prepare(
      `SELECT agent_name, tenant_id, status, started_at, finished_at, rows_written, error_message
       FROM agent_execution_log
       WHERE tenant_id = ? OR tenant_id IS NULL
       ORDER BY datetime(started_at) DESC
       LIMIT ?`,
    )
    .bind(tenantId, limit)
    .all<AgentExecutionLogRow>();

  return (results ?? []).map((row) => ({
    agentName: row.agent_name,
    tenantId: row.tenant_id,
    status: row.status as "success" | "error" | "skipped" | "started" | "completed",
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    rowsWritten: row.rows_written,
    errorMessage: row.error_message,
  }));
}
