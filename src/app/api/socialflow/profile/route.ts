export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import {
  getChannelKnowledge,
  upsertChannelCompetitor,
  upsertChannelProfile,
} from "@/lib/social/profile/repository";

export async function GET(request: Request) {
  try {
    const session = await requireCurrentSocialFlowSession(request);
    const snapshot = getChannelKnowledge(session.tenantId);
    return NextResponse.json({ ok: true, profile: snapshot.profile, competitors: snapshot.competitors, assets: snapshot.assets });
  } catch (error) {
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return NextResponse.json({ ok: false, error: "SESSION_REQUIRED" }, { status: 401 });
    }
    console.error("SOCIALFLOW_PROFILE_GET_ERROR", error);
    return NextResponse.json({ ok: false, error: "Failed to load profile" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireCurrentSocialFlowSession(request);
    const body = (await request.json().catch(() => null)) as { profile?: unknown; competitor?: unknown } | null;
    if (!body) {
      return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
    }

    if (body.profile) {
      const updated = upsertChannelProfile(session.tenantId, body.profile);
      return NextResponse.json({ ok: true, profile: updated });
    }
    if (body.competitor) {
      const competitor = upsertChannelCompetitor(session.tenantId, body.competitor);
      return NextResponse.json({ ok: true, competitor });
    }
    return NextResponse.json({ ok: false, error: "Nothing to update" }, { status: 400 });
  } catch (error) {
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return NextResponse.json({ ok: false, error: "SESSION_REQUIRED" }, { status: 401 });
    }
    console.error("SOCIALFLOW_PROFILE_POST_ERROR", error);
    return NextResponse.json({ ok: false, error: "Failed to update profile" }, { status: 500 });
  }
}
