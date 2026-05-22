export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentSocialFlowSession } from "../../../../../lib/auth/session";
import { getRuntimeChannelKnowledge } from "../../../../../lib/socialflow/profile-service";
import {
  listRuntimePostsFromDb,
  listRuntimeSocialAccountsFromDb,
  SocialContextError,
} from "../../../../../lib/socialflow/posts-repository";
import { isRuntimeAutoPublishBlockedByPrivatePilotMode } from "../../../../../lib/socialflow/private-pilot";

const DEFAULT_SAAS_ID = "socialflow";
const DRAFT_LIKE_STATUSES = new Set(["IDEA", "DRAFT", "IN_REVIEW", "APPROVED"]);

function resolveSaasId(request: Request) {
  const requested = new URL(request.url).searchParams.get("saasId");
  return requested?.trim() || DEFAULT_SAAS_ID;
}

function hasRuntimeConfiguredProfile(profile: {
  brandName?: string;
  channelName?: string;
  shortDescription?: string;
  audienceDescription?: string;
  niche?: string;
  baseKeywords?: string[];
  priorityKeywords?: string[];
  longTailKeywords?: string[];
}) {
  const brandName = (profile.brandName ?? "").trim().toLowerCase();
  const channelName = (profile.channelName ?? "").trim().toLowerCase();
  const shortDescription = (profile.shortDescription ?? "").trim().toLowerCase();
  const audienceDescription = (profile.audienceDescription ?? "").trim().toLowerCase();
  const niche = (profile.niche ?? "").trim().toLowerCase();

  const hasCustomIdentity = (brandName && brandName !== "socialflow")
    || (channelName && channelName !== "@socialflow");
  const hasCustomNarrative = (
    (shortDescription.length > 0 && !shortDescription.includes("isolated socialflow runtime"))
    || audienceDescription.length > 0
    || niche.length > 0
  );
  const hasKeywords = [
    ...(Array.isArray(profile.baseKeywords) ? profile.baseKeywords : []),
    ...(Array.isArray(profile.priorityKeywords) ? profile.priorityKeywords : []),
    ...(Array.isArray(profile.longTailKeywords) ? profile.longTailKeywords : []),
  ].some((value) => typeof value === "string" && value.trim().length > 0);

  return hasCustomIdentity || hasCustomNarrative || hasKeywords;
}

export async function GET(request: Request) {
  try {
    const session = await requireCurrentSocialFlowSession(request);
    const saasId = resolveSaasId(request);
    const [knowledge, accounts, posts] = await Promise.all([
      getRuntimeChannelKnowledge(session.tenantId),
      listRuntimeSocialAccountsFromDb({ tenantId: session.tenantId, saasId }),
      listRuntimePostsFromDb({ tenantId: session.tenantId, saasId }),
    ]);

    const linkedInConnected = accounts.some((account) => (
      account.provider === "LINKEDIN" && account.status === "CONNECTED_REAL"
    ));
    const hasDraft = posts.some((post) => DRAFT_LIKE_STATUSES.has(post.status));

    return NextResponse.json({
      ok: true,
      status: {
        saasId,
        tenantId: session.tenantId,
        profileConfigured: hasRuntimeConfiguredProfile(knowledge.profile),
        linkedInConnected,
        hasDraft,
        publishBlockedByPilotMode: isRuntimeAutoPublishBlockedByPrivatePilotMode(),
        requiresHumanApprovalForPublish: true,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return NextResponse.json({ ok: false, error: "SESSION_REQUIRED" }, { status: 401 });
    }
    if (error instanceof SocialContextError) {
      return NextResponse.json({ ok: false, error: "INVALID_SOCIAL_CONTEXT", message: error.message }, { status: 400 });
    }
    console.error("SOCIALFLOW_RUNTIME_SETUP_STATUS_ERROR", error);
    return NextResponse.json({ ok: false, error: "SETUP_STATUS_FAILED" }, { status: 500 });
  }
}
