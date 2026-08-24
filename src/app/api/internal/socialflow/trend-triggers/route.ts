import { NextResponse } from "next/server";
import { env } from "@/lib/cf";
import type { SocialFlowTrendTrigger, SocialFlowTrendTriggersSnapshot } from "@/lib/capabilities/internal-api-types/socialflow";
import { validateInternalServiceTokenRequest } from "@/lib/capabilities/internal-api-auth/service-token";

export const dynamic = "force-dynamic";

// Nivel 3 — mismo alcance que TrendTriggerConnector.ts/TrendAutoApproveCron.ts: un
// único tenant interno hardcodeado a propósito, no una feature multi-tenant. Ignora
// X-Drako-Tenant-Id del lado operator en vez de confiar en él para el filtro — evita
// que una cabecera manipulada exponga otro tenant por accidente en un endpoint nuevo.
const TREND_TRIGGER_TENANT_ID = "775444ce-5ed0-4e69-864f-dc3e0d886817";

type TriggerRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  niche: string;
  trend_score: number;
  trend_fetched_at: string;
  campaign_id: string;
  status: string;
  created_at: string;
  resolved_at: string | null;
};

type PostRow = {
  campaign_id: string;
  id: string;
  status: string;
  provider: string;
  title: string;
  scheduled_at: string | null;
  posted_at: string | null;
};

export async function GET(request: Request) {
  const authResult = validateInternalServiceTokenRequest(request);
  if (!authResult.ok) {
    return NextResponse.json(authResult.error, { status: authResult.status });
  }

  const timestamp = new Date().toISOString();
  const bindings = env();
  const db = bindings?.SOCIAL_DB;

  if (!db) {
    const response: SocialFlowTrendTriggersSnapshot = {
      service: "socialflow",
      runtime: "monolith",
      timestamp,
      requestId: authResult.requestId,
      tenantId: authResult.tenantId,
      triggers: [],
      warnings: ["SOCIALFLOW_TREND_TRIGGERS_SOCIAL_DB_UNAVAILABLE"],
    };
    return NextResponse.json(response, { status: 200 });
  }

  const url = new URL(request.url);
  const limitParam = Number.parseInt(url.searchParams.get("limit") ?? "", 10);
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 200) : 50;

  const { results: triggerRows } = await db
    .prepare(
      `SELECT id, tenant_id, saas_id, niche, trend_score, trend_fetched_at, campaign_id, status, created_at, resolved_at
       FROM socialcors_trend_triggers WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ?`,
    )
    .bind(TREND_TRIGGER_TENANT_ID, limit)
    .all<TriggerRow>();

  const rows = triggerRows ?? [];
  const campaignIds = rows.map((row) => row.campaign_id);

  let postByCampaignId = new Map<string, PostRow>();
  if (campaignIds.length > 0) {
    const placeholders = campaignIds.map(() => "?").join(", ");
    const { results: postRows } = await db
      .prepare(
        `SELECT campaign_id, id, status, provider, title, scheduled_at, posted_at
         FROM saas_social_posts WHERE tenant_id = ? AND campaign_id IN (${placeholders})`,
      )
      .bind(TREND_TRIGGER_TENANT_ID, ...campaignIds)
      .all<PostRow>();
    postByCampaignId = new Map((postRows ?? []).map((post) => [post.campaign_id, post]));
  }

  const triggers: SocialFlowTrendTrigger[] = rows.map((row) => {
    const post = postByCampaignId.get(row.campaign_id);
    return {
      id: row.id,
      tenantId: row.tenant_id,
      saasId: row.saas_id,
      niche: row.niche,
      score: row.trend_score,
      status: row.status as SocialFlowTrendTrigger["status"],
      trendFetchedAt: row.trend_fetched_at,
      createdAt: row.created_at,
      resolvedAt: row.resolved_at,
      campaignId: row.campaign_id,
      post: post
        ? {
            id: post.id,
            status: post.status,
            provider: post.provider,
            title: post.title,
            scheduledAt: post.scheduled_at,
            postedAt: post.posted_at,
          }
        : null,
    };
  });

  const response: SocialFlowTrendTriggersSnapshot = {
    service: "socialflow",
    runtime: "monolith",
    timestamp,
    requestId: authResult.requestId,
    tenantId: authResult.tenantId,
    triggers,
    warnings: [],
  };

  return NextResponse.json(response, { status: 200 });
}
