export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { getChannelKnowledge } from "@/lib/socialflow/profile/repository";
import { getLatestAudit, upsertAudit } from "@/lib/socialflow/audit/repository";
import { generateSocialAudit } from "@/lib/socialflow/audit/engine";
import {
  SocialContextError,
  getSocialAnalyticsSnapshot,
  listSaasSocialAccounts,
  resolveSocialContext,
} from "@/lib/socialflow/repository";

const DEFAULT_SAAS_ID = "socialflow";

function resolveSaasId(request: Request): string {
  const requestUrl = new URL(request.url);
  return requestUrl.searchParams.get("saasId")?.trim() || DEFAULT_SAAS_ID;
}

async function resolveAuditMetrics(tenantId: string, saasId: string) {
  try {
    const ctx = await resolveSocialContext({ tenantId, saasId });
    const [snapshot, accounts] = await Promise.all([
      getSocialAnalyticsSnapshot(ctx),
      listSaasSocialAccounts(ctx),
    ]);

    const igAccount = accounts.find((a) => a.provider === "INSTAGRAM" && a.status === "CONNECTED_REAL");
    const followersCount =
      typeof igAccount?.authMeta?.followersCount === "number"
        ? igAccount.authMeta.followersCount
        : undefined;

    const w = snapshot.last7Days;
    if (w.impressions === 0 && w.publishedPosts === 0) return null;

    return {
      impressions: w.impressions,
      likes: w.likes,
      comments: w.comments,
      shares: w.shares,
      engagement: w.engagement,
      publishedPosts: w.publishedPosts,
      followersCount,
    };
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  try {
    const session = await requireCurrentSocialFlowSession(request);
    const saasId = resolveSaasId(request);

    let audit = await getLatestAudit(session.tenantId, saasId);
    if (!audit) {
      const [snapshot, metrics] = await Promise.all([
        getChannelKnowledge(session.tenantId, saasId),
        resolveAuditMetrics(session.tenantId, saasId),
      ]);
      const generated = await generateSocialAudit({
        profile: snapshot.profile,
        competitors: snapshot.competitors,
        metrics,
        tenantId: session.tenantId,
        saasId,
      });
      audit = await upsertAudit(session.tenantId, generated, saasId);
    }

    return NextResponse.json({ ok: true, audit });
  } catch (error) {
    if (error instanceof SocialContextError) {
      return NextResponse.json({ ok: false, error: "INVALID_SOCIAL_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return NextResponse.json({ ok: false, error: "SESSION_REQUIRED" }, { status: 401 });
    }
    console.error("SOCIALFLOW_AUDIT_GET_ERROR", error);
    return NextResponse.json({ ok: false, error: "Failed to load social audit" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireCurrentSocialFlowSession(request);
    const saasId = resolveSaasId(request);

    const [snapshot, metrics] = await Promise.all([
      getChannelKnowledge(session.tenantId, saasId),
      resolveAuditMetrics(session.tenantId, saasId),
    ]);
    const generated = await generateSocialAudit({
      profile: snapshot.profile,
      competitors: snapshot.competitors,
      metrics,
      tenantId: session.tenantId,
      saasId,
    });
    const audit = await upsertAudit(session.tenantId, generated, saasId);

    return NextResponse.json({ ok: true, audit });
  } catch (error) {
    if (error instanceof SocialContextError) {
      return NextResponse.json({ ok: false, error: "INVALID_SOCIAL_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return NextResponse.json({ ok: false, error: "SESSION_REQUIRED" }, { status: 401 });
    }
    console.error("SOCIALFLOW_AUDIT_POST_ERROR", error);
    return NextResponse.json({ ok: false, error: "Failed to regenerate social audit" }, { status: 500 });
  }
}
