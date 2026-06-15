export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { getChannelKnowledge } from "@/lib/socialflow/profile/repository";
import { getLatestAudit, upsertAudit } from "@/lib/socialflow/audit/repository";
import { generateSocialAudit } from "@/lib/socialflow/audit/engine";
import { SocialContextError } from "@/lib/socialflow/repository";

const DEFAULT_SAAS_ID = "socialflow";

function resolveSaasId(request: Request): string {
  const requestUrl = new URL(request.url);
  return requestUrl.searchParams.get("saasId")?.trim() || DEFAULT_SAAS_ID;
}

export async function GET(request: Request) {
  try {
    const session = await requireCurrentSocialFlowSession(request);
    const saasId = resolveSaasId(request);

    let audit = await getLatestAudit(session.tenantId, saasId);
    if (!audit) {
      const snapshot = await getChannelKnowledge(session.tenantId, saasId);
      const generated = await generateSocialAudit({ profile: snapshot.profile, competitors: snapshot.competitors });
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

    const snapshot = await getChannelKnowledge(session.tenantId, saasId);
    const generated = await generateSocialAudit({ profile: snapshot.profile, competitors: snapshot.competitors });
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
