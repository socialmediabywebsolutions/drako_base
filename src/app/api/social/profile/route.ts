import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/session";
import {
  getChannelKnowledge,
  upsertChannelProfile,
  upsertChannelCompetitor,
} from "@/lib/social/profile/repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { tenantId } = await requireTenantAccess(request);
    const snapshot = getChannelKnowledge(tenantId);
    return NextResponse.json({ ok: true, profile: snapshot.profile, competitors: snapshot.competitors, assets: snapshot.assets });
  } catch (error) {
    console.error("SOCIAL_PROFILE_GET_ERROR", error);
    return NextResponse.json({ ok: false, error: "Failed to load profile" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { tenantId } = await requireTenantAccess(request);
    const body = (await request.json().catch(() => null)) as { profile?: any; competitor?: any } | null;
    if (!body) {
      return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
    }

    if (body.profile) {
      const updated = upsertChannelProfile(tenantId, body.profile);
      return NextResponse.json({ ok: true, profile: updated });
    }

    if (body.competitor) {
      const comp = upsertChannelCompetitor(tenantId, body.competitor);
      return NextResponse.json({ ok: true, competitor: comp });
    }

    return NextResponse.json({ ok: false, error: "Nothing to update" }, { status: 400 });
  } catch (error) {
    console.error("SOCIAL_PROFILE_POST_ERROR", error);
    return NextResponse.json({ ok: false, error: "Failed to update profile" }, { status: 500 });
  }
}
