export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { guardAiAccess } from "@/lib/socialflow/billing/enforce";
import { getChannelProfile } from "@/lib/socialflow/profile/repository";
import { SocialContextError } from "@/lib/socialflow/repository";
import { ProfileChatAgent, type ProfileChatMessage } from "@/lib/socialflow/ai/agents/ProfileChatAgent";

const DEFAULT_SAAS_ID = "socialflow";

type ChatRequestBody = {
  saasId?: string | null;
  history?: ProfileChatMessage[];
  userMessage?: string | null;
};

function normalizeHistory(value: unknown): ProfileChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (m): m is ProfileChatMessage =>
        Boolean(m) && typeof m === "object" && (m.role === "user" || m.role === "assistant") && typeof m.content === "string",
    )
    .slice(-40);
}

export async function POST(request: Request) {
  try {
    const session = await requireCurrentSocialFlowSession(request);

    const aiGuard = await guardAiAccess(session.tenantId, session.role);
    if (!aiGuard.ok) {
      return NextResponse.json({ ok: false, error: aiGuard.code, message: aiGuard.message }, { status: 403 });
    }

    const body = (await request.json().catch(() => null)) as ChatRequestBody | null;
    const saasId = body?.saasId?.trim() || DEFAULT_SAAS_ID;
    const history = normalizeHistory(body?.history);
    const userMessage = typeof body?.userMessage === "string" && body.userMessage.trim() ? body.userMessage.trim() : null;

    const currentProfile = await getChannelProfile(session.tenantId, saasId);

    const output = await new ProfileChatAgent().run({
      tenantId: session.tenantId,
      saasId,
      accountType: session.accountType,
      currentProfile,
      history,
      userMessage,
    });

    return NextResponse.json({ ok: true, ...output });
  } catch (error) {
    if (error instanceof SocialContextError) {
      return NextResponse.json({ ok: false, error: "INVALID_SOCIAL_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return NextResponse.json({ ok: false, error: "SESSION_REQUIRED" }, { status: 401 });
    }
    console.error("SOCIALFLOW_PROFILE_CHAT_ERROR", error);
    return NextResponse.json({ ok: false, error: "Failed to process profile chat turn" }, { status: 500 });
  }
}
