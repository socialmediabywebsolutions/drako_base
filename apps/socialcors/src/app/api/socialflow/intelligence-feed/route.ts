export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { getChannelKnowledge } from "@/lib/socialflow/profile/repository";
import { getLatestAudit, upsertAudit } from "@/lib/socialflow/audit/repository";
import { generateSocialAudit } from "@/lib/socialflow/audit/engine";
import { listFeedItems, seedFeedItems, updateFeedItemStatus } from "@/lib/socialflow/intelligence/repository";
import { buildFeedItemsFromAudit } from "@/lib/socialflow/intelligence/engine";
import type { IntelligenceFeedStatus } from "@/lib/socialflow/intelligence/types";
import { SocialContextError } from "@/lib/socialflow/repository";

const DEFAULT_SAAS_ID = "socialflow";
const VALID_STATUSES: IntelligenceFeedStatus[] = ["new", "read", "dismissed"];

function resolveSaasId(request: Request): string {
  const requestUrl = new URL(request.url);
  return requestUrl.searchParams.get("saasId")?.trim() || DEFAULT_SAAS_ID;
}

export async function GET(request: Request) {
  try {
    const session = await requireCurrentSocialFlowSession(request);
    const saasId = resolveSaasId(request);

    let items = await listFeedItems(session.tenantId, saasId);

    if (items.length === 0) {
      let audit = await getLatestAudit(session.tenantId, saasId);
      if (!audit) {
        const snapshot = await getChannelKnowledge(session.tenantId, saasId);
        const generated = await generateSocialAudit({ profile: snapshot.profile, competitors: snapshot.competitors, tenantId: session.tenantId, saasId });
        audit = await upsertAudit(session.tenantId, generated, saasId);
      }
      await seedFeedItems(session.tenantId, buildFeedItemsFromAudit(audit), saasId);
      items = await listFeedItems(session.tenantId, saasId);
    }

    return NextResponse.json({ ok: true, items });
  } catch (error) {
    if (error instanceof SocialContextError) {
      return NextResponse.json({ ok: false, error: "INVALID_SOCIAL_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return NextResponse.json({ ok: false, error: "SESSION_REQUIRED" }, { status: 401 });
    }
    console.error("SOCIALFLOW_INTELLIGENCE_FEED_GET_ERROR", error);
    return NextResponse.json({ ok: false, error: "Failed to load intelligence feed" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireCurrentSocialFlowSession(request);
    const saasId = resolveSaasId(request);
    const body = (await request.json().catch(() => null)) as { id?: unknown; status?: unknown } | null;

    const id = typeof body?.id === "string" ? body.id.trim() : "";
    const status = typeof body?.status === "string" ? body.status.trim() : "";

    if (!id || !VALID_STATUSES.includes(status as IntelligenceFeedStatus)) {
      return NextResponse.json({ ok: false, error: "INVALID_BODY", message: "id and a valid status are required." }, { status: 400 });
    }

    const item = await updateFeedItemStatus(session.tenantId, id, status as IntelligenceFeedStatus, saasId);
    if (!item) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, item });
  } catch (error) {
    if (error instanceof SocialContextError) {
      return NextResponse.json({ ok: false, error: "INVALID_SOCIAL_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return NextResponse.json({ ok: false, error: "SESSION_REQUIRED" }, { status: 401 });
    }
    console.error("SOCIALFLOW_INTELLIGENCE_FEED_PATCH_ERROR", error);
    return NextResponse.json({ ok: false, error: "Failed to update intelligence feed item" }, { status: 500 });
  }
}
