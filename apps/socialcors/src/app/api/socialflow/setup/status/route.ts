export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { getChannelKnowledge } from "@/lib/socialflow/profile/repository";
import {
  listSaasSocialAccounts,
  listSaasSocialPosts,
  resolveSocialContext,
  SocialContextError,
} from "@/lib/socialflow/repository";
import { isAutoPublishBlockedByPrivatePilotMode } from "@/lib/socialflow/private-pilot";

const DEFAULT_SAAS_ID = "socialflow";
const DRAFT_LIKE_STATUSES = new Set(["IDEA", "DRAFT", "IN_REVIEW", "APPROVED"]);

function resolveSaasId(request: Request) {
  const requested = new URL(request.url).searchParams.get("saasId");
  return requested?.trim() || DEFAULT_SAAS_ID;
}

function hasConfiguredProfile(profile: {
  brandName?: string;
  channelName?: string;
  shortDescription?: string;
  audienceDescription?: string;
  niche?: string;
  baseKeywords?: string[];
  priorityKeywords?: string[];
  longTailKeywords?: string[];
}) {
  const hasText = [
    profile.brandName,
    profile.channelName,
    profile.shortDescription,
    profile.audienceDescription,
    profile.niche,
  ].some((value) => typeof value === "string" && value.trim().length > 0);
  const hasKeywords = [
    ...(Array.isArray(profile.baseKeywords) ? profile.baseKeywords : []),
    ...(Array.isArray(profile.priorityKeywords) ? profile.priorityKeywords : []),
    ...(Array.isArray(profile.longTailKeywords) ? profile.longTailKeywords : []),
  ].some((value) => typeof value === "string" && value.trim().length > 0);
  return hasText || hasKeywords;
}

export async function GET(request: Request) {
  try {
    const session = await requireCurrentSocialFlowSession(request);
    const saasId = resolveSaasId(request);
    const context = await resolveSocialContext({
      tenantId: session.tenantId,
      saasId,
    });

    const [knowledge, accounts, posts] = await Promise.all([
      getChannelKnowledge(session.tenantId, saasId),
      listSaasSocialAccounts(context),
      listSaasSocialPosts(context),
    ]);

    const linkedInConnected = accounts.some((account) => (
      account.provider === "LINKEDIN" && account.status === "CONNECTED_REAL"
    ));
    const hasDraft = posts.some((post) => DRAFT_LIKE_STATUSES.has(post.status));
    const status = {
      saasId,
      tenantId: session.tenantId,
      profileConfigured: hasConfiguredProfile(knowledge.profile),
      linkedInConnected,
      hasDraft,
      publishBlockedByPilotMode: isAutoPublishBlockedByPrivatePilotMode(context.env ?? null),
      requiresHumanApprovalForPublish: true,
    };

    return NextResponse.json({ ok: true, status });
  } catch (error) {
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return NextResponse.json({ ok: false, error: "SESSION_REQUIRED" }, { status: 401 });
    }
    if (error instanceof SocialContextError) {
      return NextResponse.json({ ok: false, error: "INVALID_SOCIAL_CONTEXT", message: error.message }, { status: 400 });
    }
    console.error("SOCIALFLOW_SETUP_STATUS_ERROR", error);
    return NextResponse.json({ ok: false, error: "SETUP_STATUS_FAILED" }, { status: 500 });
  }
}
